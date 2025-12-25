import httpx
import logging
import asyncio

from .config import settings

logger = logging.getLogger(__name__)

RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


def _extract_text_from_parts(parts) -> str:
    text_bits: list[str] = []
    if isinstance(parts, list):
        for p in parts:
            if isinstance(p, dict) and p.get("text"):
                text_bits.append(str(p.get("text")))
    elif isinstance(parts, dict):
        if parts.get("text"):
            text_bits.append(str(parts.get("text")))
    return "".join(text_bits).strip()


def _safe_error_detail(res: httpx.Response) -> str:
    try:
        data = res.json()
    except Exception:
        return ""

    err = data.get("error") if isinstance(data, dict) else None
    if not isinstance(err, dict):
        return ""

    code = err.get("code")
    status = err.get("status")
    msg = err.get("message")
    bits: list[str] = []
    if code is not None:
        bits.append(f"code={code}")
    if status:
        bits.append(f"status={status}")
    if msg:
        bits.append(f"message={str(msg)[:300]}")
    return " ".join(bits)


def _sanitize_generation_config(generation_config: dict | None) -> dict:
    if not generation_config:
        return {}

    allowed: dict[str, object] = {}
    for key in ("temperature", "topP", "topK", "maxOutputTokens"):
        if key in generation_config:
            allowed[key] = generation_config[key]

    if "temperature" in allowed:
        try:
            allowed["temperature"] = float(allowed["temperature"])
        except (TypeError, ValueError):
            allowed.pop("temperature", None)

    if "topP" in allowed:
        try:
            allowed["topP"] = float(allowed["topP"])
        except (TypeError, ValueError):
            allowed.pop("topP", None)

    if "topK" in allowed:
        try:
            allowed["topK"] = int(allowed["topK"])
        except (TypeError, ValueError):
            allowed.pop("topK", None)

    if "maxOutputTokens" in allowed:
        try:
            allowed["maxOutputTokens"] = int(allowed["maxOutputTokens"])
        except (TypeError, ValueError):
            allowed.pop("maxOutputTokens", None)

    if "temperature" in allowed:
        allowed["temperature"] = max(0.0, min(2.0, float(allowed["temperature"])))

    if "topP" in allowed:
        allowed["topP"] = max(0.0, min(1.0, float(allowed["topP"])))

    if "topK" in allowed:
        allowed["topK"] = max(1, min(128, int(allowed["topK"])))

    if "maxOutputTokens" in allowed:
        allowed["maxOutputTokens"] = max(1, min(32768, int(allowed["maxOutputTokens"])))

    return allowed


def _text_url_for_model(model: str) -> str:
    return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _imagen_url() -> str:
    if "gemini" in settings.imagen_model.lower():
        # Gemini models use the generateContent endpoint even for images
        return f"https://generativelanguage.googleapis.com/v1beta/models/{settings.imagen_model}:generateContent"
    return f"https://generativelanguage.googleapis.com/v1beta/models/{settings.imagen_model}:predict"


def clean_image_prompt(base_prompt: str) -> str:
    return f"{base_prompt}. NO TEXT, NO WORDS, NO TYPOGRAPHY, NO LABELS, NO WATERMARKS, NO SIGNATURES. High contrast, sharp focus, 8k."


async def _execute_with_retry(
    url: str,
    payload: dict,
    headers: dict,
    timeout_s: float | None,
    log_model_name: str,
    max_retries: int = 3,
) -> dict:
    effective_timeout_s = float(timeout_s) if timeout_s else 180.0
    timeout = httpx.Timeout(effective_timeout_s)

    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(url, json=payload, headers=headers)
                logger.info(f"[Gemini] Response status: {res.status_code}")

                if (
                    res.status_code in RETRYABLE_STATUS_CODES
                    and attempt < max_retries - 1
                ):
                    wait_time = 2**attempt
                    logger.warning(
                        "[Gemini] Got %s from model=%s, retrying in %ss (attempt %s/%s) %s",
                        res.status_code,
                        log_model_name,
                        wait_time,
                        attempt + 1,
                        max_retries,
                        _safe_error_detail(res),
                    )
                    await asyncio.sleep(wait_time)
                    continue

                res.raise_for_status()
                return res.json()
        except httpx.HTTPStatusError as e:
            detail = _safe_error_detail(e.response)
            if e.response.status_code == 404:
                logger.error(
                    "[Gemini] Model not found/unreachable model=%s status=404 %s",
                    log_model_name,
                    detail,
                )
            elif e.response.status_code == 400:
                logger.error(
                    "[Gemini] Bad request calling model=%s status=400 %s",
                    log_model_name,
                    detail,
                )
            else:
                logger.error(
                    "[Gemini] HTTP error calling model=%s status=%s %s",
                    log_model_name,
                    e.response.status_code,
                    detail,
                )

            if (
                e.response.status_code in RETRYABLE_STATUS_CODES
                and attempt < max_retries - 1
            ):
                wait_time = 2**attempt
                logger.warning(
                    "[Gemini] Retrying model=%s in %ss (attempt %s/%s)",
                    log_model_name,
                    wait_time,
                    attempt + 1,
                    max_retries,
                )
                await asyncio.sleep(wait_time)
                continue
            raise
        except httpx.RequestError as e:
            logger.error(
                "[Gemini] Network error calling model=%s (%s) %s",
                log_model_name,
                type(e).__name__,
                str(e)[:300],
            )
            if attempt < max_retries - 1:
                wait_time = 2**attempt
                logger.warning(
                    "[Gemini] Retrying after network error in %ss (attempt %s/%s)",
                    wait_time,
                    attempt + 1,
                    max_retries,
                )
                await asyncio.sleep(wait_time)
                continue
            raise

    raise Exception(f"Max retries exceeded for Gemini API model={log_model_name}")


async def _gemini_generate_text_with_model(
    *,
    model: str,
    system_prompt: str,
    user_prompt: str,
    json_mode: bool,
    timeout_s: float | None,
    generation_config: dict | None,
) -> str:
    cfg = {
        "temperature": 0.85,
        "maxOutputTokens": 16384,
        "topK": 64,
        "topP": 0.95,
    }
    cfg.update(_sanitize_generation_config(generation_config))
    if json_mode:
        cfg["responseMimeType"] = "application/json"

    payload = {
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "generationConfig": cfg,
    }

    effective_timeout_s = (
        float(timeout_s) if timeout_s else float(settings.gemini_text_timeout_s)
    )
    logger.info(
        "[Gemini] Calling text API model=%s timeout_s=%s json_mode=%s",
        model,
        effective_timeout_s,
        json_mode,
    )

    if not settings.gemini_api_key:
        logger.error("[Gemini] API key is not set!")
        raise ValueError("STORYFORGE_GEMINI_API_KEY is not configured")

    headers = {"x-goog-api-key": settings.gemini_api_key}

    data = await _execute_with_retry(
        url=_text_url_for_model(model),
        payload=payload,
        headers=headers,
        timeout_s=effective_timeout_s,
        log_model_name=model,
    )

    # Process response
    candidates = data.get("candidates") if isinstance(data, dict) else None
    if not isinstance(candidates, list) or len(candidates) == 0:
        prompt_fb = data.get("promptFeedback") if isinstance(data, dict) else None
        block_reason = None
        if isinstance(prompt_fb, dict):
            block_reason = prompt_fb.get("blockReason") or prompt_fb.get(
                "blockReasonMessage"
            )
        logger.error(
            "[Gemini] No candidates returned model=%s blockReason=%s",
            model,
            block_reason,
        )
        raise ValueError("No candidates returned from Gemini")

    candidate = candidates[0] if isinstance(candidates[0], dict) else {}
    finish_reason = candidate.get("finishReason", "UNKNOWN")
    logger.info("[Gemini] finishReason: %s", finish_reason)

    content = candidate.get("content") if isinstance(candidate, dict) else None
    parts = content.get("parts") if isinstance(content, dict) else None
    text = _extract_text_from_parts(parts)

    # Fallbacks
    if not text and isinstance(content, dict) and content.get("text"):
        text = str(content.get("text") or "").strip()
    if not text and isinstance(candidate, dict) and candidate.get("text"):
        text = str(candidate.get("text") or "").strip()

    if not text:
        raise ValueError("Empty response from Gemini model")

    return text


async def gemini_generate_text(
    *,
    system_prompt: str,
    user_prompt: str,
    json_mode: bool,
    timeout_s: float | None,
    generation_config: dict | None,
) -> str:
    primary = settings.gemini_text_model
    fallback = getattr(settings, "gemini_text_fallback_model", "") or ""
    models: list[str] = [primary]
    if fallback and fallback != primary:
        models.append(fallback)

    last_err: Exception | None = None
    for i, model in enumerate(models):
        try:
            return await _gemini_generate_text_with_model(
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                json_mode=json_mode,
                timeout_s=timeout_s,
                generation_config=generation_config,
            )
        except httpx.HTTPStatusError as e:
            if (
                e.response is not None
                and e.response.status_code == 404
                and i < len(models) - 1
            ):
                logger.warning(
                    "[Gemini] Falling back from model=%s to model=%s due to 404",
                    model,
                    models[i + 1],
                )
                last_err = e
                continue
            last_err = e
        except ValueError as e:
            if i < len(models) - 1:
                logger.warning(
                    "[Gemini] Falling back from model=%s to model=%s due to empty/invalid response (%s)",
                    model,
                    models[i + 1],
                    type(e).__name__,
                )
                last_err = e
                continue
            last_err = e

    if last_err:
        raise last_err
    raise Exception("Gemini text generation failed")


async def gemini_generate_image(*, prompt: str, timeout_s: float | None) -> str | None:
    is_gemini_model = "gemini" in settings.imagen_model.lower()
    cleaned_prompt = clean_image_prompt(prompt)

    if is_gemini_model:
        # Gemini-style payload
        payload = {
            "contents": [{"parts": [{"text": cleaned_prompt}]}],
            "generationConfig": {
                "responseMimeType": "image/jpeg"
            }
        }
    else:
        # Legacy Imagen-style payload
        payload = {
            "instances": [{"prompt": cleaned_prompt}],
            "parameters": {"sampleCount": 1},
        }

    if not settings.gemini_api_key:
        logger.error("[Imagen] API key is not set!")
        raise ValueError("STORYFORGE_GEMINI_API_KEY is not configured")

    effective_timeout_s = (
        float(timeout_s) if timeout_s else float(settings.imagen_timeout_s)
    )
    logger.info(
        "[Imagen] Calling predict/generate model=%s timeout_s=%s gemini_mode=%s",
        settings.imagen_model,
        effective_timeout_s,
        is_gemini_model,
    )

    headers = {"x-goog-api-key": settings.gemini_api_key}

    try:
        data = await _execute_with_retry(
            url=_imagen_url(),
            payload=payload,
            headers=headers,
            timeout_s=effective_timeout_s,
            log_model_name=settings.imagen_model,
        )

        if is_gemini_model:
            # Parse Gemini response for inline image data
            # Typically candidates[0].content.parts[0].inlineData
            candidates = data.get("candidates", [])
            if not candidates:
                logger.error("[Imagen] No candidates returned from Gemini model")
                return None

            # Look for inlineData in parts
            parts = candidates[0].get("content", {}).get("parts", [])
            for part in parts:
                inline_data = part.get("inlineData")
                if inline_data:
                    mime_type = inline_data.get("mimeType", "image/png")
                    b64 = inline_data.get("data")
                    if b64:
                        return f"data:{mime_type};base64,{b64}"

            logger.error("[Imagen] No inline image data found in Gemini response")
            return None

        else:
            # Parse Imagen response
            base64_data = (data.get("predictions", [{}])[0] or {}).get("bytesBase64Encoded")
            if not base64_data:
                logger.error(
                    "[Imagen] No image bytes returned model=%s", settings.imagen_model
                )
                return None
            return f"data:image/png;base64,{base64_data}"
    except Exception as e:
        logger.error("[Imagen] Failed to generate image: %s", str(e))
        return None
