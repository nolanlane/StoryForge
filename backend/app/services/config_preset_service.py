from sqlalchemy.orm import Session
from sqlalchemy.future import select
from datetime import datetime
import json
import logging

from ..models import ConfigPreset
from ..schemas import ConfigPresetCreate, ConfigPresetUpdate, ConfigPresetSummary

logger = logging.getLogger(__name__)


async def list_presets_for_user(db: Session, user_id: int) -> list[ConfigPresetSummary]:
    result = await db.execute(
        select(ConfigPreset)
        .filter(ConfigPreset.user_id == user_id)
        .order_by(ConfigPreset.updated_at.desc())
    )
    rows = result.scalars().all()
    out: list[ConfigPresetSummary] = []
    for p in rows:
        out.append(
            ConfigPresetSummary(
                id=p.id,
                name=p.name,
                createdAt=p.created_at,
                updatedAt=p.updated_at,
            )
        )
    return out


async def get_preset_for_user(db: Session, preset_id: int, user_id: int) -> ConfigPreset | None:
    result = await db.execute(
        select(ConfigPreset).filter(ConfigPreset.id == preset_id, ConfigPreset.user_id == user_id)
    )
    return result.scalars().first()


async def create_preset_for_user(
    db: Session, req: ConfigPresetCreate, user_id: int
) -> ConfigPresetSummary:
    now = datetime.utcnow()
    preset = ConfigPreset(
        user_id=user_id,
        name=req.name,
        config_json=json.dumps(req.config or {}),
        created_at=now,
        updated_at=now,
    )
    db.add(preset)
    await db.commit()
    await db.refresh(preset)
    
    return ConfigPresetSummary(
        id=preset.id,
        name=preset.name,
        createdAt=preset.created_at,
        updatedAt=preset.updated_at,
    )


async def update_preset_for_user(
    db: Session, preset_id: int, req: ConfigPresetUpdate, user_id: int
) -> ConfigPresetSummary | None:
    result = await db.execute(
        select(ConfigPreset).filter(ConfigPreset.id == preset_id, ConfigPreset.user_id == user_id)
    )
    preset = result.scalars().first()
    if not preset:
        return None
    
    if req.name is not None:
        preset.name = req.name
    if req.config is not None:
        preset.config_json = json.dumps(req.config)
    
    preset.updated_at = datetime.utcnow()
    await db.commit()
    
    return ConfigPresetSummary(
        id=preset.id,
        name=preset.name,
        createdAt=preset.created_at,
        updatedAt=preset.updated_at,
    )


async def delete_preset_for_user(db: Session, preset_id: int, user_id: int) -> bool:
    result = await db.execute(
        select(ConfigPreset).filter(ConfigPreset.id == preset_id, ConfigPreset.user_id == user_id)
    )
    preset = result.scalars().first()
    if not preset:
        return False
    await db.delete(preset)
    await db.commit()
    return True
