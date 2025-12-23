import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .auth import create_access_token, get_current_user, hash_password, verify_password
from .config import settings
from .db import Base, engine, get_db
from .gemini_client import gemini_generate_image, gemini_generate_text
from .models import Story, User
from .schemas import (
    AiImagenRequest,
    AiImagenResponse,
    AiSequelRequest,
    AiSequelResponse,
    AiTextRequest,
    AiTextResponse,
    LoginRequest,
    SignupRequest,
    StoryDetail,
    StorySummary,
    StoryUpsert,
    TokenResponse,
    UserResponse,
)
from .services import story_service, prompt_service

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.db_url.startswith("sqlite:////data/"):
        os.makedirs("/data", exist_ok=True)
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(lifespan=lifespan)


def _validate_password(password: str) -> None:
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(status_code=422, detail="Password too long (max 72 bytes)")

origins = [o.strip() for o in (settings.cors_origins or "*").split(",") if o.strip()]
allow_creds = origins != ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=allow_creds,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


STATIC_DIR = os.environ.get("STORYFORGE_STATIC_DIR", "/app/static")
ASSETS_DIR = os.path.join(STATIC_DIR, "assets")
DEV_FRONTEND_URL = os.environ.get("STORYFORGE_DEV_FRONTEND_URL")

if os.path.isdir(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get("/")
def index() -> FileResponse:
    index_path = os.path.join(STATIC_DIR, "index.html")
    if not os.path.isfile(index_path):
        if DEV_FRONTEND_URL:
            return RedirectResponse(DEV_FRONTEND_URL, status_code=307)
        raise HTTPException(status_code=404, detail="Frontend not built")
    return FileResponse(index_path)


@app.post("/api/auth/signup", response_model=TokenResponse)
def signup(req: SignupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    existing = db.query(User).filter(User.email == req.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    _validate_password(req.password)

    try:
        pw_hash = hash_password(req.password)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    user = User(email=req.email.lower(), password_hash=pw_hash)
    db.add(user)
    db.commit()

    token = create_access_token(user.email)
    return TokenResponse(access_token=token)


@app.post("/api/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == req.email.lower()).first()

    _validate_password(req.password)

    try:
        ok = bool(user) and verify_password(req.password, user.password_hash)
    except Exception:
        ok = False

    if not ok:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user.email)
    return TokenResponse(access_token=token)


@app.get("/api/auth/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(email=current_user.email)


@app.get("/api/stories", response_model=list[StorySummary])
def list_stories(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[StorySummary]:
    return story_service.list_stories_for_user(db, current_user.id)


@app.get("/api/stories/{story_id}", response_model=StoryDetail)
def get_story(story_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> StoryDetail:
    s = story_service.get_story_for_user(db, story_id, current_user.id)
    if not s:
        raise HTTPException(status_code=404, detail="Not found")

    return StoryDetail(
        id=s.id,
        title=s.title,
        genre=s.genre,
        tone=s.tone,
        createdAt=s.created_at,
        updatedAt=s.updated_at,
        config=json.loads(s.config_json or "{}"),
        blueprint=json.loads(s.blueprint_json or "{}"),
        storyContent=json.loads(s.story_content_json or "{}"),
        storyImages=json.loads(s.story_images_json or "{}"),
        sequelOfId=s.sequel_of_id,
    )


@app.post("/api/stories", response_model=StorySummary)
def upsert_story(req: StoryUpsert, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> StorySummary:
    return story_service.upsert_story_for_user(db, req, current_user.id)


@app.delete("/api/stories/{story_id}")
def delete_story(story_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if not story_service.delete_story_for_user(db, story_id, current_user.id):
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@app.post("/api/ai/text", response_model=AiTextResponse)
async def ai_text(req: AiTextRequest, current_user: User = Depends(get_current_user)) -> AiTextResponse:
    timeout_s = (req.timeoutMs / 1000.0) if req.timeoutMs else None
    try:
        text = await gemini_generate_text(
            system_prompt=req.systemPrompt,
            user_prompt=req.userPrompt,
            json_mode=req.jsonMode,
            timeout_s=timeout_s,
            generation_config=req.generationConfig,
        )
        return AiTextResponse(text=text)
    except Exception as e:
        logger.error("AI Text Generation failed (%s)", type(e).__name__)
        raise HTTPException(status_code=502, detail="AI provider request failed")


@app.post("/api/ai/imagen", response_model=AiImagenResponse)
async def ai_imagen(req: AiImagenRequest, current_user: User = Depends(get_current_user)) -> AiImagenResponse:
    timeout_s = (req.timeoutMs / 1000.0) if req.timeoutMs else None
    try:
        data_url = await gemini_generate_image(prompt=req.prompt, timeout_s=timeout_s)
        return AiImagenResponse(dataUrl=data_url)
    except Exception as e:
        logger.error("AI Image Generation failed (%s)", type(e).__name__)
        raise HTTPException(status_code=502, detail="AI provider request failed")


@app.post("/api/ai/sequel", response_model=AiSequelResponse)
async def ai_sequel(req: AiSequelRequest, current_user: User = Depends(get_current_user)) -> AiSequelResponse:
    system_prompt = prompt_service.construct_sequel_system_prompt(
        chapter_count=req.chapterCount,
        banned_phrases=req.bannedPhrases,
        banned_descriptor_tokens=req.bannedDescriptorTokens,
    )
    user_prompt = prompt_service.construct_sequel_user_prompt(
        source_blueprint=req.sourceBlueprint,
        ending_excerpt=req.endingExcerpt,
    )

    try:
        text = await gemini_generate_text(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            json_mode=True,
            timeout_s=None,
            generation_config={"temperature": 0.8, "topP": 0.95, "topK": 64, "maxOutputTokens": 8192},
        )
        blueprint = json.loads(_extract_json(text))
        return AiSequelResponse(blueprint=blueprint)
    except Exception as e:
        logger.error("AI Sequel Generation failed (%s)", type(e).__name__)
        raise HTTPException(status_code=502, detail="AI provider request failed")


def _extract_json(text: str) -> str:
    clean = text.replace("```json", "").replace("```", "")
    first = clean.find("{")
    last = clean.rfind("}")
    if first != -1 and last != -1:
        clean = clean[first : last + 1]
    return clean


@app.get("/{full_path:path}")
def spa_fallback(full_path: str) -> FileResponse:
    if full_path.startswith("api/") or full_path.startswith("health") or full_path.startswith("assets/"):
        raise HTTPException(status_code=404, detail="Not found")

    index_path = os.path.join(STATIC_DIR, "index.html")
    if not os.path.isfile(index_path):
        if DEV_FRONTEND_URL:
            return RedirectResponse(f"{DEV_FRONTEND_URL.rstrip('/')}/{full_path}", status_code=307)
        raise HTTPException(status_code=404, detail="Frontend not built")
    return FileResponse(index_path)
