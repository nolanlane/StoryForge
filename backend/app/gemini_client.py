import httpx
import logging
import time

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
        # Some responses represent a single part as an object instead of a list.
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
        # Keep an upper bound to prevent runaway responses, but allow larger outputs
        # for newer Gemini models.
        allowed["maxOutputTokens"] = max(1, min(32768, int(allowed["maxOutputTokens"])))

    return allowed


def _text_url() -> str:
    return f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_text_model}:generateContent"


def _text_url_for_model(model: str) -> str:
    return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _imagen_url() -> str:
    return f"https://generativelanguage.googleapis.com/v1beta/models/{settings.imagen_model}:predict"


def clean_image_prompt(base_prompt: str) -> str:
    return f"{base_prompt}. NO TEXT, NO WORDS, NO TYPOGRAPHY, NO LABELS, NO WATERMARKS, NO SIGNATURES. High contrast, sharp focus, 8k." 


def _gemini_generate_text_with_model(
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

    effective_timeout_s = float(timeout_s) if timeout_s else float(settings.gemini_text_timeout_s)
    logger.info(
        "[Gemini] Calling text API model=%s timeout_s=%s json_mode=%s",
        model,
        effective_timeout_s,
        json_mode,
    )
    logger.info(
        "[Gemini] DIAGNOSTIC generationConfig=%s",
        cfg,
    )
    if not settings.gemini_api_key:
        logger.error("[Gemini] API key is not set!")
        raise ValueError("STORYFORGE_GEMINI_API_KEY is not configured")

    timeout = httpx.Timeout(timeout_s) if timeout_s else httpx.Timeout(settings.gemini_text_timeout_s)
    max_retries = 3
    headers = {"x-goog-api-key": settings.gemini_api_key}
    
    for attempt in range(max_retries):
        try:
            with httpx.Client(timeout=timeout) as client:
                res = client.post(_text_url_for_model(model), json=payload, headers=headers)
                logger.info(f"[Gemini] Response status: {res.status_code}")
                
                if res.status_code in RETRYABLE_STATUS_CODES and attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # 1s, 2s, 4s
                    logger.warning(
                        "[Gemini] Got %s from model=%s, retrying in %ss (attempt %s/%s) %s",
                        res.status_code,
                        model,
                        wait_time,
                        attempt + 1,
                        max_retries,
                        _safe_error_detail(res),
                    )
                    time.sleep(wait_time)
                    continue
                    
                res.raise_for_status()
                data = res.json()

                response_id = data.get("responseId") if isinstance(data, dict) else None
                model_version = data.get("modelVersion") if isinstance(data, dict) else None

                usage = data.get("usageMetadata") if isinstance(data, dict) else None
                if isinstance(usage, dict):
                    pt = usage.get("promptTokenCount")
                    ct = usage.get("candidatesTokenCount")
                    tt = usage.get("totalTokenCount")
                    if pt is not None or ct is not None or tt is not None:
                        logger.info(
                            "[Gemini] usage prompt=%s candidates=%s total=%s",
                            pt,
                            ct,
                            tt,
                        )

                candidates = data.get("candidates") if isinstance(data, dict) else None
                if not isinstance(candidates, list) or len(candidates) == 0:
                    prompt_fb = data.get("promptFeedback") if isinstance(data, dict) else None
                    block_reason = None
                    if isinstance(prompt_fb, dict):
                        block_reason = prompt_fb.get("blockReason") or prompt_fb.get("blockReasonMessage")

                    logger.error(
                        "[Gemini] No candidates returned model=%s responseId=%s modelVersion=%s blockReason=%s",
                        model,
                        response_id,
                        model_version,
                        block_reason,
                    )
                    raise ValueError("No candidates returned from Gemini")

                candidate = candidates[0] if isinstance(candidates[0], dict) else {}
                finish_reason = candidate.get("finishReason", "UNKNOWN")
                finish_message = candidate.get("finishMessage")
                logger.info("[Gemini] finishReason: %s", finish_reason)

                if finish_message:
                    logger.info("[Gemini] finishMessage: %s", str(finish_message)[:300])

                safety_ratings = candidate.get("safetyRatings")
                if isinstance(safety_ratings, list) and safety_ratings:
                    # Log only the categories + probabilities (no user content)
                    sr_bits: list[str] = []
                    for sr in safety_ratings[:8]:
                        if isinstance(sr, dict):
                            cat = sr.get("category")
                            prob = sr.get("probability")
                            if cat or prob:
                                sr_bits.append(f"{cat}:{prob}")
                    if sr_bits:
                        logger.info("[Gemini] safetyRatings: %s", ", ".join(sr_bits))

                content = candidate.get("content") if isinstance(candidate, dict) else None
                parts = content.get("parts") if isinstance(content, dict) else None
                text = _extract_text_from_parts(parts)

                # Fallbacks for unexpected response shapes.
                if not text and isinstance(content, dict) and content.get("text"):
                    text = str(content.get("text") or "").strip()
                if not text and isinstance(candidate, dict) and candidate.get("text"):
                    text = str(candidate.get("text") or "").strip()

                # DIAGNOSTIC: Log response structure to debug truncation.
                logger.info(
                    "[Gemini] DIAGNOSTIC model=%s text_length=%s parts_count=%s content_keys=%s",
                    model,
                    len(text) if text else 0,
                    len(parts) if isinstance(parts, list) else (1 if parts else 0),
                    ",".join(content.keys()) if isinstance(content, dict) else "none",
                )

                if not text:
                    prompt_fb = data.get("promptFeedback") if isinstance(data, dict) else None
                    block_reason = None
                    if isinstance(prompt_fb, dict):
                        block_reason = prompt_fb.get("blockReason") or prompt_fb.get("blockReasonMessage")

                    logger.warning(
                        "[Gemini] Empty text response model=%s responseId=%s modelVersion=%s finishReason=%s blockReason=%s",
                        model,
                        response_id,
                        model_version,
                        finish_reason,
                        block_reason,
                    )

                    # Diagnostics without leaking prompts: tell us the response shape.
                    content_keys = list(content.keys()) if isinstance(content, dict) else []
                    candidate_keys = list(candidate.keys()) if isinstance(candidate, dict) else []
                    logger.warning(
                        "[Gemini] Empty text diagnostics contentType=%s partsType=%s contentKeys=%s candidateKeys=%s",
                        type(content).__name__,
                        type(parts).__name__,
                        ",".join(content_keys[:30]),
                        ",".join(candidate_keys[:30]),
                    )

                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt
                        logger.warning(
                            "[Gemini] Retrying after empty response in %ss (attempt %s/%s)",
                            wait_time,
                            attempt + 1,
                            max_retries,
                        )
                        time.sleep(wait_time)
                        continue

                    raise ValueError("Empty response from Gemini model")

                return text
        except httpx.HTTPStatusError as e:
            detail = _safe_error_detail(e.response)
            if e.response.status_code == 404:
                logger.error(
                    "[Gemini] Text model not found/unreachable model=%s endpoint=v1beta status=404 %s",
                    model,
                    detail,
                )
            elif e.response.status_code == 400:
                logger.error(
                    "[Gemini] Bad request calling model=%s status=400 %s",
                    model,
                    detail,
                )
            else:
                logger.error(
                    "[Gemini] HTTP error calling model=%s status=%s %s",
                    model,
                    e.response.status_code,
                    detail,
                )

            if e.response.status_code in RETRYABLE_STATUS_CODES and attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logger.warning(
                    "[Gemini] Retrying model=%s in %ss (attempt %s/%s)",
                    model,
                    wait_time,
                    attempt + 1,
                    max_retries,
                )
                time.sleep(wait_time)
                continue
            raise
        except httpx.RequestError as e:
            logger.error(
                "[Gemini] Network error calling model=%s (%s) %s",
                model,
                type(e).__name__,
                str(e)[:300],
            )
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logger.warning(
                    "[Gemini] Retrying after network error in %ss (attempt %s/%s)",
                    wait_time,
                    attempt + 1,
                    max_retries,
                )
                time.sleep(wait_time)
                continue
            raise
    
    raise Exception("Max retries exceeded for Gemini API")


def gemini_generate_text(*, system_prompt: str, user_prompt: str, json_mode: bool, timeout_s: float | None, generation_config: dict | None) -> str:
    primary = settings.gemini_text_model
    fallback = getattr(settings, "gemini_text_fallback_model", "") or ""
    models: list[str] = [primary]
    if fallback and fallback != primary:
        models.append(fallback)

    last_err: Exception | None = None
    for i, model in enumerate(models):
        try:
            return _gemini_generate_text_with_model(
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                json_mode=json_mode,
                timeout_s=timeout_s,
                generation_config=generation_config,
            )
        except httpx.HTTPStatusError as e:
            # If the primary model is unavailable, fall back.
            if e.response is not None and e.response.status_code == 404 and i < len(models) - 1:
                logger.warning(
                    "[Gemini] Falling back from model=%s to model=%s due to 404",
                    model,
                    models[i + 1],
                )
                last_err = e
                continue
            last_err = e
        except ValueError as e:
            # Preview models can return candidates with empty content; fall back to a stable model.
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


def gemini_generate_image(*, prompt: str, timeout_s: float | None) -> str | None:
    payload = {
        "instances": [{"prompt": clean_image_prompt(prompt)}],
        "parameters": {"sampleCount": 1},
    }

    if not settings.gemini_api_key:
        logger.error("[Imagen] API key is not set!")
        raise ValueError("STORYFORGE_GEMINI_API_KEY is not configured")

    effective_timeout_s = float(timeout_s) if timeout_s else float(settings.imagen_timeout_s)
    logger.info("[Imagen] Calling predict model=%s timeout_s=%s", settings.imagen_model, effective_timeout_s)

    timeout = httpx.Timeout(timeout_s) if timeout_s else httpx.Timeout(settings.imagen_timeout_s)
    max_retries = 3
    headers = {"x-goog-api-key": settings.gemini_api_key}
    
    for attempt in range(max_retries):
        try:
            with httpx.Client(timeout=timeout) as client:
                res = client.post(_imagen_url(), json=payload, headers=headers)

                logger.info("[Imagen] Response status: %s", res.status_code)
                
                if res.status_code in RETRYABLE_STATUS_CODES and attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.warning(
                        "[Imagen] Got %s from model=%s, retrying in %ss (attempt %s/%s) %s",
                        res.status_code,
                        settings.imagen_model,
                        wait_time,
                        attempt + 1,
                        max_retries,
                        _safe_error_detail(res),
                    )
                    time.sleep(wait_time)
                    continue
                
                res.raise_for_status()
                data = res.json()
                base64_data = (data.get("predictions", [{}])[0] or {}).get("bytesBase64Encoded")
                if not base64_data:
                    logger.error("[Imagen] No image bytes returned model=%s", settings.imagen_model)
                    return None
                return f"data:image/png;base64,{base64_data}"
        except httpx.HTTPStatusError as e:
            detail = _safe_error_detail(e.response)
            if e.response.status_code == 404:
                logger.error(
                    "[Imagen] Model not found/unreachable model=%s status=404 %s",
                    settings.imagen_model,
                    detail,
                )
            else:
                logger.error(
                    "[Imagen] HTTP error calling model=%s status=%s %s",
                    settings.imagen_model,
                    e.response.status_code,
                    detail,
                )
            if e.response.status_code in RETRYABLE_STATUS_CODES and attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logger.warning(
                    "[Imagen] Retrying model=%s in %ss (attempt %s/%s)",
                    settings.imagen_model,
                    wait_time,
                    attempt + 1,
                    max_retries,
                )
                time.sleep(wait_time)
                continue
            raise
        except httpx.RequestError as e:
            logger.error(
                "[Imagen] Network error calling model=%s (%s) %s",
                settings.imagen_model,
                type(e).__name__,
                str(e)[:300],
            )
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logger.warning(
                    "[Imagen] Retrying after network error in %ss (attempt %s/%s)",
                    wait_time,
                    attempt + 1,
                    max_retries,
                )
                time.sleep(wait_time)
                continue
            raise
    
    return None  # Return None if all retries fail for images
