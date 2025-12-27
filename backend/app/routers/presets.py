import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db import get_db
from app.models import User
from app.schemas import (
    ConfigPresetCreate,
    ConfigPresetDetail,
    ConfigPresetSummary,
    ConfigPresetUpdate,
)
from app.services import config_preset_service

router = APIRouter(prefix="/api/config-presets", tags=["config-presets"])

@router.get("", response_model=list[ConfigPresetSummary])
async def list_config_presets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConfigPresetSummary]:
    return await config_preset_service.list_presets_for_user(db, current_user.id)


@router.get("/{preset_id}", response_model=ConfigPresetDetail)
async def get_config_preset(
    preset_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConfigPresetDetail:
    preset = await config_preset_service.get_preset_for_user(db, preset_id, current_user.id)
    if not preset:
        raise HTTPException(status_code=404, detail="Not found")
    return ConfigPresetDetail(
        id=preset.id,
        name=preset.name,
        config=json.loads(preset.config_json or "{}"),
        createdAt=preset.created_at,
        updatedAt=preset.updated_at,
    )


@router.post("", response_model=ConfigPresetSummary)
async def create_config_preset(
    req: ConfigPresetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConfigPresetSummary:
    return await config_preset_service.create_preset_for_user(db, req, current_user.id)


@router.put("/{preset_id}", response_model=ConfigPresetSummary)
async def update_config_preset(
    preset_id: int,
    req: ConfigPresetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConfigPresetSummary:
    preset = await config_preset_service.update_preset_for_user(db, preset_id, req, current_user.id)
    if not preset:
        raise HTTPException(status_code=404, detail="Not found")
    return preset


@router.delete("/{preset_id}")
async def delete_config_preset(
    preset_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not await config_preset_service.delete_preset_for_user(db, preset_id, current_user.id):
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}
