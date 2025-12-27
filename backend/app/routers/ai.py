import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.auth import get_current_user
from app.models import User
from app.schemas import (
    AiChapterRequest,
    AiImagenRequest,
    AiImagenResponse,
    AiSequelRequest,
    AiSequelResponse,
    AiStoryDoctorRequest,
    AiStoryDoctorResponse,
    AiTextRequest,
    AiTextResponse,
)
from app.services import prompt_service
from app.gemini_client import (
    gemini_generate_image,
    gemini_generate_text,
    gemini_generate_text_stream,
    safe_error_detail,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _extract_json(text: str) -> str:
    clean = text.replace("```json", "").replace("```", "")
    first_obj = clean.find("{")
    first_arr = clean.find("[")

    if first_obj == -1 and first_arr == -1:
        return clean

    if first_obj == -1:
        first = first_arr
        last = clean.rfind("]")
    elif first_arr == -1:
        first = first_obj
        last = clean.rfind("}")
    else:
        # Pick whichever appears first in the string.
        if first_arr < first_obj:
            first = first_arr
            last = clean.rfind("]")
        else:
            first = first_obj
            last = clean.rfind("}")

    if first != -1 and last != -1 and last >= first:
        clean = clean[first : last + 1]
    return clean


@router.post("/text", response_model=AiTextResponse)
async def ai_text(
    req: AiTextRequest, current_user: User = Depends(get_current_user)
) -> AiTextResponse:
    timeout_s = (req.timeoutMs / 1000.0) if req.timeoutMs else None
    try:
        text = await gemini_generate_text(
            system_prompt=req.systemPrompt,
            user_prompt=req.userPrompt,
            json_mode=req.jsonMode,
            timeout_s=timeout_s,
            generation_config=req.generationConfig,
            text_model=req.textModel,
            text_fallback_model=req.textFallbackModel,
        )
        return AiTextResponse(text=text)
    except Exception as e:
        logger.error("AI Text Generation failed: %s", str(e))
        detail = "AI provider request failed"
        if isinstance(e, ValueError):
            detail = str(e)
        elif hasattr(e, "response") and e.response is not None:
            d = safe_error_detail(e.response)
            if d:
                detail = f"Provider Error: {d}"
        
        raise HTTPException(status_code=502, detail=detail)


@router.post("/chapter", response_model=AiTextResponse)
async def ai_chapter(
    req: AiChapterRequest, current_user: User = Depends(get_current_user)
) -> AiTextResponse:
    timeout_s = (req.timeoutMs / 1000.0) if req.timeoutMs else None
    try:
        chapter_info = req.blueprint.get("chapters", [])[req.chapterIndex]
    except IndexError:
        raise HTTPException(422, "Invalid chapter index")

    use_genre_tone = not req.config.get("disableGenreTone", False)
    system_prompt = prompt_service.get_chapter_system_prompt(
        writing_style=req.config.get("writingStyle", ""),
        tone=req.config.get("tone", ""),
        text_model=req.textModel,
        use_genre_tone=use_genre_tone,
    )
    user_prompt = prompt_service.construct_chapter_user_prompt(
        blueprint=req.blueprint,
        chapter_index=req.chapterIndex,
        chapter_title=chapter_info.get("title", ""),
        chapter_summary=chapter_info.get("summary", ""),
        previous_chapter_text=req.previousChapterText,
        config=req.config,
        chapter_guidance=req.chapterGuidance,
    )

    try:
        text = await gemini_generate_text(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            json_mode=False,
            timeout_s=timeout_s,
            generation_config=req.generationConfig,
            text_model=req.textModel,
            text_fallback_model=req.textFallbackModel,
        )
        return AiTextResponse(text=text)
    except Exception as e:
        logger.error("AI Chapter Generation failed: %s", str(e))
        detail = "AI provider request failed"
        if isinstance(e, ValueError):
            detail = str(e)
        elif hasattr(e, "response") and e.response is not None:
             d = safe_error_detail(e.response)
             if d:
                 detail = f"Provider Error: {d}"
        raise HTTPException(status_code=502, detail=detail)


@router.post("/text/stream")
async def ai_text_stream(
    req: AiTextRequest, current_user: User = Depends(get_current_user)
) -> StreamingResponse:
    timeout_s = (req.timeoutMs / 1000.0) if req.timeoutMs else None
    
    async def generator():
        try:
            async for chunk in gemini_generate_text_stream(
                system_prompt=req.systemPrompt,
                user_prompt=req.userPrompt,
                timeout_s=timeout_s,
                generation_config=req.generationConfig,
                text_model=req.textModel,
                text_fallback_model=req.textFallbackModel,
            ):
                yield chunk
        except Exception as e:
            logger.error("AI Stream failed: %s", str(e))
            # Yield a specific error marker that frontend can detect if stream breaks mid-way
            yield f"\n\n[ERROR: {str(e)}]"

    return StreamingResponse(generator(), media_type="text/plain")


@router.post("/chapter/stream")
async def ai_chapter_stream(
    req: AiChapterRequest, current_user: User = Depends(get_current_user)
) -> StreamingResponse:
    timeout_s = (req.timeoutMs / 1000.0) if req.timeoutMs else None
    try:
        chapter_info = req.blueprint.get("chapters", [])[req.chapterIndex]
    except IndexError:
        raise HTTPException(422, "Invalid chapter index")

    use_genre_tone = not req.config.get("disableGenreTone", False)
    system_prompt = prompt_service.get_chapter_system_prompt(
        writing_style=req.config.get("writingStyle", ""),
        tone=req.config.get("tone", ""),
        text_model=req.textModel,
        use_genre_tone=use_genre_tone,
    )
    user_prompt = prompt_service.construct_chapter_user_prompt(
        blueprint=req.blueprint,
        chapter_index=req.chapterIndex,
        chapter_title=chapter_info.get("title", ""),
        chapter_summary=chapter_info.get("summary", ""),
        previous_chapter_text=req.previousChapterText,
        config=req.config,
        chapter_guidance=req.chapterGuidance,
    )

    async def generator():
        try:
            async for chunk in gemini_generate_text_stream(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                timeout_s=timeout_s,
                generation_config=req.generationConfig,
                text_model=req.textModel,
                text_fallback_model=req.textFallbackModel,
            ):
                yield chunk
        except Exception as e:
            logger.error("AI Chapter Stream failed: %s", str(e))
            yield f"\n\n[ERROR: {str(e)}]"

    return StreamingResponse(generator(), media_type="text/plain")


@router.post("/analyze_blueprint", response_model=AiStoryDoctorResponse)
async def ai_analyze_blueprint(
    req: AiStoryDoctorRequest, current_user: User = Depends(get_current_user)
) -> AiStoryDoctorResponse:
    system_prompt = prompt_service.get_story_doctor_system_prompt()
    user_prompt = prompt_service.construct_story_doctor_user_prompt(req.blueprint)

    timeout_s = (req.timeoutMs / 1000.0) if getattr(req, "timeoutMs", None) else None

    try:
        text = await gemini_generate_text(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            json_mode=True,
            timeout_s=timeout_s,
            generation_config=(
                req.generationConfig
                if getattr(req, "generationConfig", None) is not None
                else {
                    "temperature": 0.6,
                    "topP": 0.95,
                    "topK": 64,
                    "maxOutputTokens": 2048,
                }
            ),
            text_model=getattr(req, "textModel", None),
            text_fallback_model=getattr(req, "textFallbackModel", None),
        )
        suggestions = json.loads(_extract_json(text))
        if not isinstance(suggestions, list) or not all(
            isinstance(s, str) for s in suggestions
        ):
            raise ValueError("AI returned invalid suggestion format")
        return AiStoryDoctorResponse(suggestions=suggestions)
    except Exception as e:
        logger.error("AI Story Doctor failed: %s", str(e))
        detail = "AI provider request failed"
        if isinstance(e, ValueError):
            detail = str(e)
        elif hasattr(e, "response") and e.response is not None:
             d = safe_error_detail(e.response)
             if d:
                 detail = f"Provider Error: {d}"
        raise HTTPException(status_code=502, detail=detail)


@router.post("/imagen", response_model=AiImagenResponse)
async def ai_imagen(
    req: AiImagenRequest, current_user: User = Depends(get_current_user)
) -> AiImagenResponse:
    timeout_s = (req.timeoutMs / 1000.0) if req.timeoutMs else None
    try:
        data_url = await gemini_generate_image(
            prompt=req.prompt,
            timeout_s=timeout_s,
            imagen_model=req.imagenModel,
        )
        if not data_url:
            raise HTTPException(status_code=502, detail="AI provider returned no image")
        return AiImagenResponse(dataUrl=data_url)
    except Exception as e:
        logger.error("AI Image Generation failed: %s", str(e))
        detail = "AI provider request failed"
        if isinstance(e, ValueError):
            detail = str(e)
        elif hasattr(e, "response") and e.response is not None:
             d = safe_error_detail(e.response)
             if d:
                 detail = f"Provider Error: {d}"
        raise HTTPException(status_code=502, detail=detail)

@router.post("/sequel", response_model=AiSequelResponse)
async def ai_sequel(
    req: AiSequelRequest, current_user: User = Depends(get_current_user)
) -> AiSequelResponse:
    system_prompt = prompt_service.construct_sequel_system_prompt(
        chapter_count=req.chapterCount,
        banned_phrases=req.bannedPhrases,
        banned_descriptor_tokens=req.bannedDescriptorTokens,
        text_model=getattr(req, "textModel", None),
    )
    user_prompt = prompt_service.construct_sequel_user_prompt(
        source_blueprint=req.sourceBlueprint,
        ending_excerpt=req.endingExcerpt,
    )

    timeout_s = (req.timeoutMs / 1000.0) if getattr(req, "timeoutMs", None) else None

    try:
        text = await gemini_generate_text(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            json_mode=True,
            timeout_s=timeout_s,
            generation_config=(
                req.generationConfig
                if getattr(req, "generationConfig", None) is not None
                else {
                    "temperature": 0.8,
                    "topP": 0.95,
                    "topK": 64,
                    "maxOutputTokens": 8192,
                }
            ),
            text_model=getattr(req, "textModel", None),
            text_fallback_model=getattr(req, "textFallbackModel", None),
        )
        blueprint = json.loads(_extract_json(text))
        return AiSequelResponse(blueprint=blueprint)
    except Exception as e:
        logger.error("AI Sequel Generation failed: %s", str(e))
        detail = "AI provider request failed"
        if isinstance(e, ValueError):
            detail = str(e)
        elif hasattr(e, "response") and e.response is not None:
             d = safe_error_detail(e.response)
             if d:
                 detail = f"Provider Error: {d}"
        raise HTTPException(status_code=502, detail=detail)
