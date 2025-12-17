# syntax=docker/dockerfile:1

# Stage 1: Build frontend
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app
COPY frontend /app/frontend
WORKDIR /app/frontend
RUN npm ci || npm install
RUN ln -s /app/frontend/node_modules /app/node_modules
RUN npm run build

# Stage 2: Production runtime
FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# System deps for bcrypt/cryptography + curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app/backend
COPY --from=frontend-build /app/frontend/dist /app/static

# Environment defaults
ENV STORYFORGE_STATIC_DIR=/app/static
ENV STORYFORGE_DB_URL=sqlite:////data/storyforge.db
ENV STORYFORGE_CORS_ORIGINS=*

# RunPod volume mount point
VOLUME /data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
