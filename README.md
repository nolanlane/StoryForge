# StoryForge

AI-powered story generation app. Single container: React frontend + FastAPI backend.

## Quick Deploy to RunPod

### 1. Build & Push Docker Image

```bash
# Build the image
docker build -t your-dockerhub-username/storyforge:latest .

# Push to Docker Hub (or your preferred registry)
docker push your-dockerhub-username/storyforge:latest
```

### 2. RunPod Setup

1. **Create a Pod** with your image (`your-dockerhub-username/storyforge:latest`)
2. **Expose HTTP Port**: `8000`
3. **Add Volume**: Mount at `/data` (for SQLite database persistence)
4. **Environment Variables**:
   - `STORYFORGE_GEMINI_API_KEY` - Your Google AI API key (required)
   - `STORYFORGE_JWT_SECRET` - Random secret for auth tokens (required, e.g. `openssl rand -hex 32`)

That's it. The app will be available at your RunPod URL.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STORYFORGE_GEMINI_API_KEY` | ✅ | - | Google AI API key |
| `STORYFORGE_JWT_SECRET` | ✅ | - | Secret for JWT signing |
| `STORYFORGE_DB_URL` | - | `sqlite:////data/storyforge.db` | Database connection |
| `STORYFORGE_CORS_ORIGINS` | - | `*` | Allowed CORS origins |

## Local Development

### Docker Compose (recommended)

```bash
cp .env.example .env
# Edit .env with your API keys

docker compose up
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000

### Manual

**Backend:**
```bash
pip install -r requirements.txt
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Production Build (Local Test)

```bash
docker compose --profile prod up storyforge
```

Single container at http://localhost:8000
