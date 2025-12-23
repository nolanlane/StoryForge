# Storyforge Codebase Audit Report

**Date:** October 26, 2023
**Auditor:** Jules (Senior Software Architect)

## 1. Stability & Bugs

### Concurrency & Blocking Operations
**Severity: High**

The current implementation of the FastAPI backend uses synchronous blocking functions (`def`) for IO-bound operations, specifically the AI generation endpoints.

*   **Observation:** In `backend/app/main.py`, endpoints like `ai_text`, `ai_imagen`, and `ai_sequel` are defined as standard functions (e.g., `def ai_text(...)`).
*   **Impact:** FastAPI runs these functions in a threadpool. While this prevents blocking the main event loop, it limits concurrency to the size of the threadpool and introduces thread-switching overhead.
*   **Underlying Issue:** The `gemini_client.py` uses `httpx.Client`, which is a synchronous client.
*   **Recommendation:** Refactor these endpoints to `async def` and switch to `httpx.AsyncClient` in `gemini_client.py`. This allows Python's `asyncio` loop to handle concurrent requests much more efficiently, which is critical for RunPod environments where you want to maximize throughput per container.

```python
# backend/app/main.py - Current
@app.post("/api/ai/text", ...)
def ai_text(...):
    text = gemini_generate_text(...)

# backend/app/gemini_client.py - Current
with httpx.Client(timeout=timeout) as client:
    res = client.post(...)
```

### Error Handling & Reliability
**Severity: Medium**

*   **Retry Logic:** `gemini_client.py` implements a retry loop (max 3 retries) for specific status codes. However, this logic is duplicated across `_gemini_generate_text_with_model` and `gemini_generate_image`. If the container restarts during a long-running request (common in spot instances or deployments), the client simply receives a connection error.
*   **Timeout Management:** The timeouts are user-controllable (via `req.timeoutMs`) but rely on the synchronous `httpx` timeout. If the client disconnects, the server might continue processing in the background (wasting credits) until it tries to write the response.

### Security
**Severity: Medium**

*   **CORS Configuration:** `backend/app/main.py` defaults to allowing all origins (`*`) if `STORYFORGE_CORS_ORIGINS` is not set.
    *   **Recommendation:** Enforce strict CORS origins in production configuration.
*   **Input Validation:** While Pydantic handles type validation, the `ai_sequel` endpoint accepts a `sourceBlueprint` which is limited by size (`_limit_source_blueprint_size`), but deeply nested recursive JSON could potentially cause parsing issues or high memory usage during `json.loads`.

## 2. Redundancy & Cleanliness (DRY)

### Duplicated Logic in Gemini Client
**Severity: Low (Maintenance Debt)**

The `gemini_client.py` file contains duplicated retry logic and error handling code between text and image generation functions.

*   **Refactoring Opportunity:** Create a generic `execute_with_retry` wrapper or decorator that handles the `httpx` exceptions, logging, and exponential backoff.

### Route Handler Bloat
**Severity: Medium**

`backend/app/main.py` contains significant business logic mixed with request handling.

*   **Example:** `upsert_story` manually constructs/updates the Story model and handles JSON serialization.
*   **Example:** `ai_sequel` contains a large, hardcoded prompt template string directly in the route handler.
*   **Recommendation:** Extract "Story" logic into `backend/app/services/story_service.py` and AI prompt construction into `backend/app/services/prompt_service.py`.

## 3. Architecture & Enhancements

### Docker Optimization
**Severity: Medium**

The current `Dockerfile` is functional but can be optimized for faster builds and smaller layers.

*   **Current State:**
    ```dockerfile
    COPY backend /app/backend
    COPY --from=frontend-build /app/frontend/dist /app/static
    ```
*   **Issue:** Any change in `backend/` invalidates the layer.
*   **Recommendation:**
    1.  Ensure `.dockerignore` excludes `__pycache__`, `*.pyc`, `tests/`, and `node_modules`.
    2.  The multi-stage build is good.
    3.  Consider compiling python dependencies into wheels in a separate stage or using a virtual environment copied over to keep the runtime image strictly minimal.

### Logic Flow: Async Task Queue
**Severity: High (Architectural Improvement)**

The application currently uses a generic Request/Response cycle for AI generation. Text generation can take 10-60+ seconds.

*   **Problem:** HTTP connections are fragile over long durations. Browsers or proxies (like RunPod's ingress) might timeout before the backend finishes.
*   **Recommendation:** Implement an asynchronous "Job" pattern.
    1.  **POST /api/ai/text** -> Returns `{ "jobId": "..." }` immediately.
    2.  Backend pushes task to a queue (could be in-memory `asyncio.Queue` for simple single-instance, or Redis/Celery for robust distributed setups).
    3.  **GET /api/jobs/{jobId}** -> Polling endpoint for status/result.
    *   *Note:* Given the current SQLite setup, a simple in-memory queue or a database-backed job table would suffice for a single-instance deployment, dramatically improving user experience reliability.

### Database
**Severity: Low**

*   **Observation:** The app uses SQLite (`sqlite:////data/storyforge.db`).
*   **Verdict:** For a single-container deployment on RunPod with a persistent volume mounted at `/data`, this is perfectly acceptable and efficient. No immediate need to switch to Postgres unless horizontal scaling is required.
