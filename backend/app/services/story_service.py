from sqlalchemy.orm import Session
from sqlalchemy.future import select
from datetime import datetime
import json
import logging

from ..models import Story
from ..schemas import StoryUpsert, StorySummary

logger = logging.getLogger(__name__)


async def list_stories_for_user(db: Session, user_id: int) -> list[StorySummary]:
    result = await db.execute(
        select(Story)
        .filter(Story.user_id == user_id)
        .order_by(Story.updated_at.desc())
    )
    rows = result.scalars().all()
    out: list[StorySummary] = []
    for s in rows:
        out.append(
            StorySummary(
                id=s.id,
                title=s.title,
                genre=s.genre,
                tone=s.tone,
                createdAt=s.created_at,
                updatedAt=s.updated_at,
                sequelOfId=s.sequel_of_id,
            )
        )
    return out


async def get_story_for_user(db: Session, story_id: str, user_id: int) -> Story | None:
    result = await db.execute(
        select(Story).filter(Story.id == story_id, Story.user_id == user_id)
    )
    return result.scalars().first()


async def upsert_story_for_user(
    db: Session, req: StoryUpsert, user_id: int
) -> StorySummary:
    now = datetime.utcnow()
    result = await db.execute(
        select(Story).filter(Story.id == req.id, Story.user_id == user_id)
    )
    s = result.scalars().first()
    if not s:
        s = Story(
            id=req.id,
            user_id=user_id,
            created_at=now,
            updated_at=now,
        )
        db.add(s)

    s.title = req.title or ""
    s.genre = req.genre or ""
    s.tone = req.tone or ""
    s.updated_at = now
    s.sequel_of_id = req.sequelOfId

    s.config_json = json.dumps(req.config or {})
    s.blueprint_json = json.dumps(req.blueprint or {})
    s.story_content_json = json.dumps(req.storyContent or {})
    s.story_images_json = json.dumps(req.storyImages or {})

    await db.commit()

    return StorySummary(
        id=s.id,
        title=s.title,
        genre=s.genre,
        tone=s.tone,
        createdAt=s.created_at,
        updatedAt=s.updated_at,
        sequelOfId=s.sequel_of_id,
    )


async def delete_story_for_user(db: Session, story_id: str, user_id: int) -> bool:
    result = await db.execute(
        select(Story).filter(Story.id == story_id, Story.user_id == user_id)
    )
    s = result.scalars().first()
    if not s:
        return False
    await db.delete(s)
    await db.commit()
    return True
