import json
import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from .auth import create_access_token, get_current_user, hash_password, verify_password
from .config import settings
from .db import Base, engine, get_db
from .gemini_client import gemini_generate_image, gemini_generate_text
from .models import User
from .schemas import (
    AiChapterRequest,
    AiImagenRequest,
    AiImagenResponse,
    AiSequelRequest,
    AiSequelResponse,
    AiStoryDoctorRequest,
    AiStoryDoctorResponse,
    AiTextRequest,
    AiTextResponse,
    ConfigPresetCreate,
    ConfigPresetDetail,
    ConfigPresetSummary,
    ConfigPresetUpdate,
    LoginRequest,
    SignupRequest,
    StoryDetail,
    StorySummary,
    StoryUpsert,
    TokenResponse,
    UserResponse,
)
from .services import story_service, prompt_service, config_preset_service

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.db_url.startswith("sqlite:////data/"):
        os.makedirs("/data", exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(lifespan=lifespan)


def _validate_password(password: str) -> None:
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(status_code=422, detail="Password too long (max 72 bytes)")


origins = [o.strip() for o in (settings.cors_origins or "*").split(",") if o.strip()]
allow_creds = origins != ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=allow_creds,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


STATIC_DIR = os.environ.get("STORYFORGE_STATIC_DIR", "/app/static")
ASSETS_DIR = os.path.join(STATIC_DIR, "assets")
DEV_FRONTEND_URL = os.environ.get("STORYFORGE_DEV_FRONTEND_URL")

if os.path.isdir(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get("/")
async def index() -> FileResponse:
    index_path = os.path.join(STATIC_DIR, "index.html")
    if not os.path.isfile(index_path):
        if DEV_FRONTEND_URL:
            return RedirectResponse(DEV_FRONTEND_URL, status_code=307)
        raise HTTPException(status_code=404, detail="Frontend not built")
    return FileResponse(index_path)


@app.post("/api/auth/signup", response_model=TokenResponse)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    existing = await db.execute(select(User).filter(User.email == req.email.lower()))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    _validate_password(req.password)

    try:
        pw_hash = hash_password(req.password)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    user = User(email=req.email.lower(), password_hash=pw_hash)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.email)
    return TokenResponse(access_token=token)


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    result = await db.execute(select(User).filter(User.email == req.email.lower()))
    user = result.scalars().first()

    _validate_password(req.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    try:
        ok = verify_password(req.password, user.password_hash)
    except Exception:
        ok = False

    if not ok:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_email = user.email
    token = create_access_token(user_email)
    return TokenResponse(access_token=token)


@app.get("/api/auth/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(email=current_user.email)


@app.get("/api/stories", response_model=list[StorySummary])
async def list_stories(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[StorySummary]:
    return await story_service.list_stories_for_user(db, current_user.id)


@app.get("/api/stories/{story_id}", response_model=StoryDetail)
async def get_story(
    story_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StoryDetail:
    s = await story_service.get_story_for_user(db, story_id, current_user.id)
    if not s:
        raise HTTPException(status_code=404, detail="Not found")

    return StoryDetail(
        id=s.id,
        title=s.title,
        genre=s.genre,
        tone=s.tone,
        createdAt=s.created_at,
        updatedAt=s.updated_at,
        config=json.loads(s.config_json or "{}"),
        blueprint=json.loads(s.blueprint_json or "{}"),
        storyContent=json.loads(s.story_content_json or "{}"),
        storyImages=json.loads(s.story_images_json or "{}"),
        sequelOfId=s.sequel_of_id,
    )


@app.post("/api/stories", response_model=StorySummary)
async def upsert_story(
    req: StoryUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StorySummary:
    return await story_service.upsert_story_for_user(db, req, current_user.id)


@app.delete("/api/stories/{story_id}")
async def delete_story(
    story_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not await story_service.delete_story_for_user(db, story_id, current_user.id):
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@app.get("/api/config-presets", response_model=list[ConfigPresetSummary])
async def list_config_presets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConfigPresetSummary]:
    return await config_preset_service.list_presets_for_user(db, current_user.id)


@app.get("/api/config-presets/{preset_id}", response_model=ConfigPresetDetail)
async def get_config_preset(
    preset_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConfigPresetDetail:
    preset = await config_preset_service.get_preset_for_user(db, preset_id, current_user.id)
    if not preset:
        raise HTTPException(status_code=404, detail="Not found")
    return ConfigPresetDetail(
        id=preset.id,
        name=preset.name,
        config=json.loads(preset.config_json or "{}"),
        createdAt=preset.created_at,
        updatedAt=preset.updated_at,
    )


@app.post("/api/config-presets", response_model=ConfigPresetSummary)
async def create_config_preset(
    req: ConfigPresetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConfigPresetSummary:
    return await config_preset_service.create_preset_for_user(db, req, current_user.id)


@app.put("/api/config-presets/{preset_id}", response_model=ConfigPresetSummary)
async def update_config_preset(
    preset_id: int,
    req: ConfigPresetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConfigPresetSummary:
    preset = await config_preset_service.update_preset_for_user(db, preset_id, req, current_user.id)
    if not preset:
        raise HTTPException(status_code=404, detail="Not found")
    return preset


@app.delete("/api/config-presets/{preset_id}")
async def delete_config_preset(
    preset_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not await config_preset_service.delete_preset_for_user(db, preset_id, current_user.id):
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@app.post("/api/ai/text", response_model=AiTextResponse)
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
        logger.error("AI Text Generation failed (%s)", type(e).__name__)
        raise HTTPException(status_code=502, detail="AI provider request failed")


@app.post("/api/ai/chapter", response_model=AiTextResponse)
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
        logger.error("AI Chapter Generation failed (%s)", type(e).__name__)
        raise HTTPException(status_code=502, detail="AI provider request failed")


@app.post("/api/ai/analyze_blueprint", response_model=AiStoryDoctorResponse)
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
        logger.error("AI Story Doctor failed (%s)", type(e).__name__)
        raise HTTPException(status_code=502, detail="AI provider request failed")


@app.post("/api/ai/imagen", response_model=AiImagenResponse)
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
        logger.error("AI Image Generation failed (%s)", type(e).__name__)
        raise HTTPException(status_code=502, detail="AI provider request failed")


@app.post("/api/ai/sequel", response_model=AiSequelResponse)
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
        logger.error("AI Sequel Generation failed (%s)", type(e).__name__)
        raise HTTPException(status_code=502, detail="AI provider request failed")


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


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str) -> FileResponse:
    if (
        full_path.startswith("api/")
        or full_path.startswith("health")
        or full_path.startswith("assets/")
    ):
        raise HTTPException(status_code=404, detail="Not found")

    index_path = os.path.join(STATIC_DIR, "index.html")
    if not os.path.isfile(index_path):
        if DEV_FRONTEND_URL:
            return RedirectResponse(
                f"{DEV_FRONTEND_URL.rstrip('/')}/{full_path}", status_code=307
            )
        raise HTTPException(status_code=404, detail="Frontend not built")
    return FileResponse(index_path)
