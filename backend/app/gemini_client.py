import httpx
import logging
import asyncio
import random
import time
from typing import Any

from .config import settings

logger = logging.getLogger(__name__)

RETRYABLE_STATUS_CODES = {408, 425, 429, 500, 502, 503, 504}

# RunPod sits behind Cloudflare and can return 524 when a request holds open too long.
RUNPOD_RETRYABLE_STATUS_CODES = RETRYABLE_STATUS_CODES | {524}

TEXT_MODEL_ALLOWLIST: dict[str, str] = {
    "gemini-3-pro": "Gemini 3 Pro (preview) – reasoning, long context",
    "gemini-3-flash": "Gemini 3 Flash (preview) – speed-focused multimodal",
    "gemini-2.5-pro": "Gemini 2.5 Pro – high-quality reasoning, long context",
    "gemini-2.5-flash": "Gemini 2.5 Flash – balanced price/perf, fast",
    "gemini-2.5-flash-lite": "Gemini 2.5 Flash-Lite – cost-optimized",
    "gemini-2.0-flash": "Gemini 2.0 Flash – previous-gen fast model",
    "gemini-2.0-flash-001": "Gemini 2.0 Flash stable variant",
    "gemini-2.0-flash-exp": "Gemini 2.0 Flash experimental",
    "xstory": "XStory – uncensored vLLM via RunPod",
}

IMAGE_MODEL_ALLOWLIST: dict[str, str] = {
    "gemini-2.5-flash-image": "Gemini 2.5 Flash Image – stable image+text",
    "gemini-2.5-flash-image-preview": "Gemini 2.5 Flash Image Preview (deprecated)",
    "gemini-2.0-flash-preview-image-generation": "Gemini 2.0 Flash Preview Image Generation",
}


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
    if model not in TEXT_MODEL_ALLOWLIST:
        raise ValueError(f"Unsupported text model '{model}'. Allowed: {', '.join(TEXT_MODEL_ALLOWLIST)}")
    return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _imagen_url(model: str) -> str:
    if model not in IMAGE_MODEL_ALLOWLIST:
        raise ValueError(
            f"Unsupported image model '{model}'. Allowed: {', '.join(IMAGE_MODEL_ALLOWLIST)}"
        )
    if "gemini" in model.lower():
        # Gemini models use the generateContent endpoint even for images
        return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:predict"


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
    start_ts = time.monotonic()

    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(url, json=payload, headers=headers)
                elapsed = time.monotonic() - start_ts
                logger.info(
                    "[Gemini] Response status=%s model=%s attempt=%s elapsed=%.2fs",
                    res.status_code,
                    log_model_name,
                    attempt + 1,
                    elapsed,
                )

                if (
                    res.status_code in RETRYABLE_STATUS_CODES
                    and attempt < max_retries - 1
                ):
                    wait_time = (2**attempt) * random.uniform(0.5, 1.5)
                    logger.warning(
                        "[Gemini] Got %s from model=%s, retrying in %.2fs (attempt %s/%s) %s",
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
                logger.info(
                    "[Gemini] Success model=%s attempts=%s total_elapsed=%.2fs",
                    log_model_name,
                    attempt + 1,
                    elapsed,
                )
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
                wait_time = (2**attempt) * random.uniform(0.5, 1.5)
                logger.warning(
                    "[Gemini] Retrying after network error in %.2fs (attempt %s/%s)",
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


async def _runpod_generate_text(
    *,
    system_prompt: str,
    user_prompt: str,
    json_mode: bool,
    timeout_s: float | None,
    generation_config: dict | None,
) -> str:
    """Generate text using RunPod Serverless vLLM endpoint for XStory model."""
    if not settings.runpod_api_key:
        logger.error("[RunPod] API key is not set!")
        raise ValueError("STORYFORGE_RUNPOD_API_KEY is not configured")

    effective_timeout_s = (
        float(timeout_s) if timeout_s else float(settings.runpod_timeout_s)
    )
    
    # RunPod vLLM worker expects a standard Serverless envelope:
    # {"input": {"messages": [...], "sampling_params": {...}}}
    # https://docs.runpod.io/serverless/vllm/vllm-requests

    cfg = {
        "temperature": 0.85,
        "top_p": 0.95,
        "top_k": 64,
        "max_tokens": 4096,
    }
    sanitized = _sanitize_generation_config(generation_config)
    if "temperature" in sanitized:
        cfg["temperature"] = sanitized["temperature"]
    if "topP" in sanitized:
        cfg["top_p"] = sanitized["topP"]
    if "topK" in sanitized:
        cfg["top_k"] = sanitized["topK"]
    if "maxOutputTokens" in sanitized:
        cfg["max_tokens"] = sanitized["maxOutputTokens"]

    # Some vLLM deployments behave better with an explicit JSON-only reminder.
    effective_system_prompt = system_prompt
    if json_mode:
        effective_system_prompt = (
            f"{system_prompt}\n\nReturn valid JSON only. Do not include markdown fences."
        )

    payload = {
        "input": {
            "messages": [
                {"role": "system", "content": effective_system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "sampling_params": cfg,
        }
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.runpod_api_key}",
    }

    runsync_url = f"https://api.runpod.ai/v2/{settings.runpod_endpoint_id}/runsync"
    run_url = f"https://api.runpod.ai/v2/{settings.runpod_endpoint_id}/run"
    
    logger.info(
        "[RunPod] Calling vLLM endpoint=%s timeout_s=%s json_mode=%s",
        settings.runpod_endpoint_id,
        effective_timeout_s,
        json_mode,
    )

    def _extract_runpod_text(data: Any) -> str | None:
        if not isinstance(data, dict):
            return None

        output = data.get("output")
        if isinstance(output, list) and output:
            # Some RunPod vLLM workers return output as a list of records.
            # Example observed:
            # output: [{"choices": [{"tokens": ["..."]}], "usage": {...}}]
            first = output[0]
            if isinstance(first, str) and first.strip():
                return first.strip()

            if isinstance(first, dict):
                choices = first.get("choices")
                if isinstance(choices, list) and choices:
                    c0 = choices[0] if isinstance(choices[0], dict) else {}

                    # vLLM can return tokens as a list of strings.
                    tokens = c0.get("tokens")
                    if isinstance(tokens, list) and tokens:
                        return "".join(str(t) for t in tokens).strip()

                    # Some variants return plain text.
                    text_val = c0.get("text")
                    if isinstance(text_val, str) and text_val.strip():
                        return text_val.strip()
                    if isinstance(text_val, list) and text_val:
                        return "".join(str(x) for x in text_val).strip()

                    # OpenAI-compatible style.
                    msg = c0.get("message")
                    if isinstance(msg, dict):
                        content = msg.get("content")
                        if isinstance(content, str) and content.strip():
                            return content.strip()

                # Alternate keys
                if isinstance(first.get("output"), str) and str(first.get("output")).strip():
                    return str(first.get("output")).strip()
                if isinstance(first.get("text"), str) and str(first.get("text")).strip():
                    return str(first.get("text")).strip()

        if isinstance(output, dict):
            # Common vLLM worker format: output.text is list[str]
            text_val = output.get("text")
            if isinstance(text_val, list) and text_val:
                return "".join(str(x) for x in text_val).strip()
            if isinstance(text_val, str) and text_val.strip():
                return text_val.strip()

            # Alternate keys occasionally seen
            alt = output.get("output")
            if isinstance(alt, str) and alt.strip():
                return alt.strip()
            if isinstance(alt, list) and alt:
                return "".join(str(x) for x in alt).strip()
        elif isinstance(output, str) and output.strip():
            return output.strip()

        return None

    async def _poll_status(*, client: httpx.AsyncClient, job_id: str) -> dict:
        status_url = (
            f"https://api.runpod.ai/v2/{settings.runpod_endpoint_id}/status/{job_id}"
        )
        start = time.monotonic()
        # Small, bounded backoff; keep it responsive.
        sleep_s = 0.5
        while True:
            elapsed = time.monotonic() - start
            if elapsed > effective_timeout_s:
                raise TimeoutError("RunPod job timed out")

            res = await client.get(status_url, headers=headers)
            if res.status_code >= 400:
                # Treat transient gateway/timeouts as retryable during polling.
                if res.status_code in RUNPOD_RETRYABLE_STATUS_CODES:
                    await asyncio.sleep(sleep_s)
                    sleep_s = min(2.0, sleep_s * 1.3)
                    continue
                res.raise_for_status()

            data = res.json()

            status = data.get("status") if isinstance(data, dict) else None
            if status == "COMPLETED":
                return data
            if status == "FAILED":
                raise ValueError("RunPod job failed")

            await asyncio.sleep(sleep_s)
            sleep_s = min(2.0, sleep_s * 1.3)

    timeout = httpx.Timeout(float(effective_timeout_s))
    async with httpx.AsyncClient(timeout=timeout) as client:
        # Avoid /runsync for long-running jobs (notably JSON blueprint generation)
        # because Cloudflare can return 524 if the request stays open too long.
        use_runsync = not json_mode

        if use_runsync:
            # Prefer /runsync (single round-trip). If it returns only an id/status,
            # fall back to polling /status.
            try:
                response = await client.post(runsync_url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()

                text = _extract_runpod_text(data)
                if text:
                    return text

                if isinstance(data, dict) and data.get("id"):
                    job_id = str(data.get("id"))
                    polled = await _poll_status(client=client, job_id=job_id)
                    text = _extract_runpod_text(polled)
                    if text:
                        return text

                logger.error("[RunPod] Unexpected runsync response format: %s", data)
                raise ValueError("Invalid response format from RunPod")
            except (httpx.HTTPStatusError, httpx.RequestError, TimeoutError) as e:
                logger.warning(
                    "[RunPod] runsync failed (%s); retrying with /run + polling",
                    type(e).__name__,
                )

        try:
            # Submit async job with /run, then poll /status until completion.
            # Retry submission once if the gateway returns transient 5xx/524.
            job_id: str | None = None
            for attempt in range(2):
                response = await client.post(run_url, json=payload, headers=headers)
                if (
                    response.status_code >= 400
                    and response.status_code in RUNPOD_RETRYABLE_STATUS_CODES
                    and attempt == 0
                ):
                    await asyncio.sleep(0.8)
                    continue

                response.raise_for_status()
                data = response.json()
                job_id = str((data or {}).get("id") or "")
                break

            if not job_id:
                logger.error("[RunPod] No job id returned from /run")
                raise ValueError("RunPod /run did not return a job id")

            polled = await _poll_status(client=client, job_id=job_id)
            text = _extract_runpod_text(polled)
            if not text:
                logger.error("[RunPod] Unexpected /status response format: %s", polled)
                raise ValueError("Invalid RunPod /status output")
            return text
        except httpx.HTTPStatusError as e:
            logger.error(
                "[RunPod] HTTP error status=%s message=%s",
                e.response.status_code,
                e.response.text[:500],
            )
            raise
        except httpx.RequestError as e:
            logger.error("[RunPod] Network error: %s", str(e)[:300])
            raise


async def gemini_generate_text(
    *,
    system_prompt: str,
    user_prompt: str,
    json_mode: bool,
    timeout_s: float | None,
    generation_config: dict | None,
    text_model: str | None = None,
    text_fallback_model: str | None = None,
) -> str:
    primary = text_model or settings.gemini_text_model
    
    # Route XStory requests to RunPod - no fallback for XStory
    if primary.lower() == "xstory":
        return await _runpod_generate_text(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            json_mode=json_mode,
            timeout_s=timeout_s,
            generation_config=generation_config,
        )
    
    # Don't use XStory as fallback for other models
    fallback = (text_fallback_model or getattr(settings, "gemini_text_fallback_model", "") or "").strip()
    models: list[str] = [primary]
    if fallback and fallback != primary and fallback.lower() != "xstory":
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
            status = e.response.status_code if e.response is not None else None
            if (
                status in {404}
                and i < len(models) - 1
            ):
                logger.warning(
                    "[Gemini] Falling back from model=%s to model=%s due to status=%s",
                    model,
                    models[i + 1],
                    status,
                )
                last_err = e
                continue
            if (
                status in RETRYABLE_STATUS_CODES
                and i < len(models) - 1
            ):
                logger.warning(
                    "[Gemini] Falling back from model=%s to model=%s due to retryable status=%s",
                    model,
                    models[i + 1],
                    status,
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
        except httpx.RequestError as e:
            if i < len(models) - 1:
                logger.warning(
                    "[Gemini] Falling back from model=%s to model=%s due to network error (%s)",
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


async def gemini_generate_image(
    *,
    prompt: str,
    timeout_s: float | None,
    imagen_model: str | None = None,
) -> str | None:
    selected_model = (imagen_model or settings.imagen_model).strip()
    if selected_model not in IMAGE_MODEL_ALLOWLIST:
        raise ValueError(
            f"Unsupported image model '{selected_model}'. Allowed: {', '.join(IMAGE_MODEL_ALLOWLIST)}"
        )
    is_gemini_model = "gemini" in selected_model.lower()
    cleaned_prompt = clean_image_prompt(prompt)

    if is_gemini_model:
        # Gemini-style payload - no responseMimeType for image generation
        payload = {
            "contents": [{"parts": [{"text": cleaned_prompt}]}],
            "generationConfig": {}
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
        selected_model,
        effective_timeout_s,
        is_gemini_model,
    )

    headers = {"x-goog-api-key": settings.gemini_api_key}

    try:
        data = await _execute_with_retry(
            url=_imagen_url(selected_model),
            payload=payload,
            headers=headers,
            timeout_s=effective_timeout_s,
            log_model_name=selected_model,
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
                    "[Imagen] No image bytes returned model=%s", selected_model
                )
                return None
            return f"data:image/png;base64,{base64_data}"
    except Exception as e:
        logger.error("[Imagen] Failed to generate image: %s", str(e))
        return None
