import httpx
import logging
import time

from .config import settings

logger = logging.getLogger(__name__)

RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


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
        allowed["maxOutputTokens"] = max(1, min(8192, int(allowed["maxOutputTokens"])))

    return allowed


def _text_url() -> str:
    return f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_text_model}:generateContent"


def _imagen_url() -> str:
    # Options: imagen-4.0-generate-001 (standard), imagen-4.0-ultra-generate-001 (best quality), imagen-4.0-fast-generate-001 (fastest)
    return "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-ultra-generate-001:predict"


def clean_image_prompt(base_prompt: str) -> str:
    return f"{base_prompt}. NO TEXT, NO WORDS, NO TYPOGRAPHY, NO LABELS, NO WATERMARKS, NO SIGNATURES. High contrast, sharp focus, 8k." 


def gemini_generate_text(*, system_prompt: str, user_prompt: str, json_mode: bool, timeout_s: float | None, generation_config: dict | None) -> str:
    cfg = {
        "temperature": 0.85,
        "maxOutputTokens": 8192,
        "topK": 64,
        "topP": 0.95,
    }
    cfg.update(_sanitize_generation_config(generation_config))
    if json_mode:
        cfg["responseMimeType"] = "application/json"

    payload = {
        "contents": [{"parts": [{"text": user_prompt}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "generationConfig": cfg,
    }

    logger.info(f"[Gemini] Calling text API with timeout={timeout_s}, json_mode={json_mode}")
    if not settings.gemini_api_key:
        logger.error("[Gemini] API key is not set!")
        raise ValueError("STORYFORGE_GEMINI_API_KEY is not configured")

    timeout = httpx.Timeout(timeout_s) if timeout_s else httpx.Timeout(90.0)
    max_retries = 3
    headers = {"x-goog-api-key": settings.gemini_api_key}
    
    for attempt in range(max_retries):
        try:
            with httpx.Client(timeout=timeout) as client:
                res = client.post(_text_url(), json=payload, headers=headers)
                logger.info(f"[Gemini] Response status: {res.status_code}")
                
                if res.status_code in RETRYABLE_STATUS_CODES and attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # 1s, 2s, 4s
                    logger.warning(f"[Gemini] Got {res.status_code}, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                    continue
                    
                res.raise_for_status()
                data = res.json()
                candidate = data.get("candidates", [{}])[0]
                finish_reason = candidate.get("finishReason", "UNKNOWN")
                logger.info(f"[Gemini] finishReason: {finish_reason}")
                text = (
                    candidate
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                    or ""
                )
                if not text:
                    logger.warning("[Gemini] Empty text response.")
                return text
        except httpx.HTTPStatusError as e:
            if e.response.status_code in RETRYABLE_STATUS_CODES and attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logger.warning(f"[Gemini] Got {e.response.status_code}, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
                continue
            raise
    
    raise Exception("Max retries exceeded for Gemini API")


def gemini_generate_image(*, prompt: str, timeout_s: float | None) -> str | None:
    payload = {
        "instances": [{"prompt": clean_image_prompt(prompt)}],
        "parameters": {"sampleCount": 1},
    }

    if not settings.gemini_api_key:
        logger.error("[Imagen] API key is not set!")
        raise ValueError("STORYFORGE_GEMINI_API_KEY is not configured")

    timeout = httpx.Timeout(timeout_s) if timeout_s else httpx.Timeout(25.0)
    max_retries = 3
    headers = {"x-goog-api-key": settings.gemini_api_key}
    
    for attempt in range(max_retries):
        try:
            with httpx.Client(timeout=timeout) as client:
                res = client.post(_imagen_url(), json=payload, headers=headers)
                
                if res.status_code in RETRYABLE_STATUS_CODES and attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.warning(f"[Imagen] Got {res.status_code}, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                    continue
                
                res.raise_for_status()
                data = res.json()
                base64_data = (data.get("predictions", [{}])[0] or {}).get("bytesBase64Encoded")
                if not base64_data:
                    return None
                return f"data:image/png;base64,{base64_data}"
        except httpx.HTTPStatusError as e:
            if e.response.status_code in RETRYABLE_STATUS_CODES and attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logger.warning(f"[Imagen] Got {e.response.status_code}, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
                continue
            raise
    
    return None  # Return None if all retries fail for images
