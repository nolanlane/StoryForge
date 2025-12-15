# StoryForge

Single-page React app + FastAPI backend.

## Backend (FastAPI)

### Environment variables

- `STORYFORGE_GEMINI_API_KEY` (required)
- `STORYFORGE_JWT_SECRET` (required)
- `STORYFORGE_DB_URL` (optional, default `sqlite:////data/storyforge.db`)
- `STORYFORGE_CORS_ORIGINS` (optional, default `*`)
- `STORYFORGE_STATIC_DIR` (optional, default `/app/static`)

### Local dev

1. Install Python deps

```bash
pip install -r requirements.txt
```

2. Run API

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Frontend (Vite)

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:8000`.

## Runpod

- Mount a persistent volume at `/data`.
- Set env vars:
  - `STORYFORGE_GEMINI_API_KEY`
  - `STORYFORGE_JWT_SECRET`
- Expose port `8000`.

The container serves the SPA and `/api/*` from the same process.
