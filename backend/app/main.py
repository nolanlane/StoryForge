import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import Base, engine
from .routers import auth, stories, presets, ai

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.db_url.startswith("sqlite:////data/"):
        os.makedirs("/data", exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(lifespan=lifespan)

origins = [o.strip() for o in (settings.cors_origins or "*").split(",") if o.strip()]
allow_creds = origins != ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=allow_creds,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(stories.router)
app.include_router(presets.router)
app.include_router(ai.router)

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
