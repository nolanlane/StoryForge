# StoryForge Audit & Roadmap

## 1. Architecture Overview

### Backend (`/backend`)
*   **Stack:** FastAPI, SQLAlchemy (Async), SQLite.
*   **Key Services:**
    *   `gemini_client.py`: Robust handling of Google Gemini & RunPod (vLLM) requests with retry logic.
    *   `story_service.py`: Story CRUD operations.
    *   `prompt_service.py`: Centralized prompt engineering.
*   **Authentication:** JWT-based auth (`auth.py`).

### Frontend (`/frontend`)
*   **Stack:** React (Vite), TailwindCSS, Capacitor (for Android).
*   **State Management:** Monolithic state in `App.jsx` passing props down to views (`SetupView`, `ReaderView`, etc.).
*   **Styling:** Utility-first CSS (Tailwind).

---

## 2. Critical Findings & Bugs

### A. Fragile Markdown Rendering
*   **Issue:** `ReaderView.jsx` uses a custom `renderMarkdown` function that manually splits text by newlines and handles only basic bold/italic regex.
*   **Risk:** AI models often output complex markdown (lists, headers, blockquotes) which will break the reader view or render as raw text.
*   **Fix:** Replace with `react-markdown` for robust rendering.

### B. Monolithic State Management
*   **Issue:** `App.jsx` is over 1100 lines long, managing auth, story state, UI views, and API logic.
*   **Risk:** Hard to maintain, debug, and test. "Prop drilling" makes adding features difficult.
*   **Fix:** Refactor into a `StoryContext` or use a state management library (Zustand/Redux) to separate concerns. Move PDF logic to a utility.

### C. PDF Export Logic
*   **Issue:** PDF generation logic relies on `window.jspdf` loaded via CDN script tag in `App.jsx` and manually calculates line splits.
*   **Risk:** Brittle typesetting; dependent on external CDN availability; blocks the main thread.
*   **Fix:** Use a library like `react-pdf` or `html2canvas` + `jspdf` properly imported via npm, or move generation to a Web Worker.

---

## 3. Prompting & AI Enhancements

### A. "Show, Don't Tell" Enforcement
*   **Observation:** While the prompt asks for "Scene, Not Summary", models (especially smaller Flash models) tend to summarize.
*   **Suggestion:** Inject "Negative Constraints" more aggressively. Explicitly penalize summary words in the system prompt. Add a "Style Enforcer" pass if generation is detected as too abstract.

### B. Blueprint Fidelity
*   **Observation:** The "Story Doctor" currently suggests changes but doesn't automatically apply them to the blueprint JSON.
*   **Suggestion:** Implement a structured output mode for the Story Doctor that returns a *patch* for the blueprint, allowing one-click application of suggestions.

### C. XStory (RunPod) Integration
*   **Observation:** The backend supports `xstory` (uncensored), but the prompt templates in `prompt_service.py` need careful tuning to ensure they don't trigger "refusal" styles even in open models (e.g. avoiding "As an AI..." preambles which some fine-tunes still retain).

---

## 4. Proposed Implementation Plan

### Phase 1: Stability & Core Fixes (High Priority)
1.  **Install `react-markdown`** and replace custom renderer in `ReaderView`.
2.  **Refactor `App.jsx`**: Move PDF logic to `lib/pdfGenerator.js`.
3.  **Fix RunPod/Gemini Fallbacks**: Ensure clear error messages propagate to UI when keys are missing or quotas exceeded.

### Phase 2: User Experience (Medium Priority)
1.  **Streaming Text**: Implement streaming response in frontend for perceived speed (currently awaits full response).
2.  **Auto-Save**: Improve auto-save reliability (currently triggers on specific actions).

### Phase 3: Advanced AI Features (Low Priority)
1.  **Interactive Story Doctor**: Allow the doctor to edit the blueprint directly.
2.  **Character consistency**: Inject character visual descriptions into every chapter prompt to ensure behavioral consistency.

---

## 5. Security & Infra
*   **Database Path**: The default `sqlite:////data/storyforge.db` assumes a root-level `/data` directory, which may fail on standard Linux user permissions without Docker. Recommended to change default to relative path `./storyforge.db` or user-home based path for local dev.
*   **Secret Management**: `STORYFORGE_JWT_SECRET` is required. Ensure documentation emphasizes this for production.
