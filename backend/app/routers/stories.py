import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db import get_db
from app.models import User
from app.schemas import StoryDetail, StorySummary, StoryUpsert
from app.services import story_service

router = APIRouter(prefix="/api/stories", tags=["stories"])

@router.get("", response_model=list[StorySummary])
async def list_stories(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[StorySummary]:
    return await story_service.list_stories_for_user(db, current_user.id)


@router.get("/{story_id}", response_model=StoryDetail)
async def get_story(
    story_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StoryDetail:
    s = await story_service.get_story_for_user(db, story_id, current_user.id)
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


@router.post("", response_model=StorySummary)
async def upsert_story(
    req: StoryUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StorySummary:
    return await story_service.upsert_story_for_user(db, req, current_user.id)


@router.delete("/{story_id}")
async def delete_story(
    story_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not await story_service.delete_story_for_user(db, story_id, current_user.id):
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}
