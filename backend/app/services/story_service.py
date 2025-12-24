from sqlalchemy.orm import Session
from datetime import datetime
import json
import logging

from ..models import Story
from ..schemas import StoryUpsert, StorySummary

logger = logging.getLogger(__name__)


def list_stories_for_user(db: Session, user_id: int) -> list[StorySummary]:
    rows = (
        db.query(Story)
        .filter(Story.user_id == user_id)
        .order_by(Story.updated_at.desc())
        .all()
    )
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


def get_story_for_user(db: Session, story_id: str, user_id: int) -> Story | None:
    return (
        db.query(Story).filter(Story.id == story_id, Story.user_id == user_id).first()
    )


def upsert_story_for_user(db: Session, req: StoryUpsert, user_id: int) -> StorySummary:
    now = datetime.utcnow()
    s = db.query(Story).filter(Story.id == req.id, Story.user_id == user_id).first()
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

    db.commit()

    return StorySummary(
        id=s.id,
        title=s.title,
        genre=s.genre,
        tone=s.tone,
        createdAt=s.created_at,
        updatedAt=s.updated_at,
        sequelOfId=s.sequel_of_id,
    )


def delete_story_for_user(db: Session, story_id: str, user_id: int) -> bool:
    s = db.query(Story).filter(Story.id == story_id, Story.user_id == user_id).first()
    if not s:
        return False
    db.delete(s)
    db.commit()
    return True
