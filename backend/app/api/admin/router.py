from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.admin_auth import AdminContext, require_admin
from app.core.config import settings
from app.database import get_db
from app.models.prompt_profile_version import PromptProfileVersion
from app.schemas.prompt_profile import (
    AdminSessionResponse,
    PromptProfileDefaultResponse,
    PromptProfileDeleteRequest,
    PromptProfileListResponse,
    PromptProfilePreviewRequest,
    PromptProfilePreviewResponse,
    PromptProfileResponse,
    PromptProfileRollbackRequest,
    PromptProfileUpsertRequest,
    PromptProfileVersionResponse,
)
from app.services.prompt_profile_versions import (
    create_version,
    get_latest_versions_map,
    get_version,
    list_versions,
)
from app.services.prompt_profiles import (
    delete_prompt_profile,
    get_default_prompt_profile,
    get_prompt_profile,
    prompt_profile_manager,
    list_prompt_profiles,
    reload_prompt_profiles,
    save_prompt_profile,
)

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.post("/session", response_model=AdminSessionResponse)
async def admin_session(context: AdminContext = Depends(require_admin)) -> AdminSessionResponse:
    return AdminSessionResponse(actor=context.actor, message="登录成功")


def _profile_updated_at() -> datetime:
    path = settings.PROMPT_PROFILES_PATH
    try:
        mtime = os.path.getmtime(path)
    except FileNotFoundError:
        return datetime.now(timezone.utc)
    return datetime.fromtimestamp(mtime, tz=timezone.utc)


def _to_response(
    key: str,
    payload: Dict[str, Any],
    version: PromptProfileVersion | None = None,
) -> PromptProfileResponse:
    updated_at = version.created_at if version and version.created_at else _profile_updated_at()
    return PromptProfileResponse(
        key=key,
        display_name=str(payload.get("display_name") or key),
        system_template=str(payload.get("system_template") or ""),
        user_template=str(payload.get("user_template") or ""),
        aliases=[str(alias) for alias in payload.get("aliases", []) if str(alias).strip()],
        schema=payload.get("schema"),
        updated_at=updated_at,
        last_actor=version.actor if version else None,
        last_comment=version.comment if version else None,
        last_version=version.version if version else None,
    )


@router.get("/prompts", response_model=PromptProfileListResponse)
async def list_prompts(
    _: AdminContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PromptProfileListResponse:
    profiles = list_prompt_profiles()
    latest_versions = get_latest_versions_map(db, list(profiles.keys()))
    responses: List[PromptProfileResponse] = []
    for key, payload in profiles.items():
        responses.append(_to_response(key, payload, latest_versions.get(key)))
    responses.sort(key=lambda item: item.key)
    return PromptProfileListResponse(profiles=responses)


@router.get("/prompts/{key}", response_model=PromptProfileResponse)
async def get_prompt_detail(
    key: str,
    _: AdminContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PromptProfileResponse:
    payload = get_prompt_profile(key)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="配置不存在")
    latest_versions = get_latest_versions_map(db, [key])
    return _to_response(key, payload, latest_versions.get(key))


@router.post("/prompts/{key}/preview", response_model=PromptProfilePreviewResponse)
async def preview_prompt(
    key: str,
    body: PromptProfilePreviewRequest,
    _: AdminContext = Depends(require_admin),
) -> PromptProfilePreviewResponse:
    payload = get_prompt_profile(key)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="配置不存在")

    note_type = body.note_type or str(payload.get("display_name") or key)
    tags = body.tags

    profile = prompt_profile_manager.resolve(key)
    system_prompt, user_prompt = profile.render_prompts(note_type=note_type, tags=tags)

    return PromptProfilePreviewResponse(
        key=profile.key,
        display_name=profile.display_name,
        note_type=note_type,
        tags=tags,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        schema=profile.schema_payload(),
    )


@router.get("/prompts/{key}/default", response_model=PromptProfileDefaultResponse)
async def get_prompt_default(key: str, _: AdminContext = Depends(require_admin)) -> PromptProfileDefaultResponse:
    payload = get_default_prompt_profile(key)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未找到默认配置")
    return PromptProfileDefaultResponse(key=key, payload=payload)


@router.post("/prompts", response_model=PromptProfileResponse, status_code=status.HTTP_201_CREATED)
async def upsert_prompt(
    body: PromptProfileUpsertRequest,
    context: AdminContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PromptProfileResponse:
    save_payload = body.model_dump(by_alias=True)
    comment = save_payload.pop("comment", None)
    profile = save_prompt_profile(save_payload)
    reload_prompt_profiles()
    latest_payload = get_prompt_profile(profile.key)
    assert latest_payload is not None
    version_payload = {"key": profile.key, **latest_payload}
    version = create_version(
        db,
        profile_key=profile.key,
        payload=version_payload,
        actor=context.actor,
        comment=comment,
    )
    return _to_response(profile.key, latest_payload, version)


@router.delete("/prompts/{key}", status_code=status.HTTP_200_OK)
async def remove_prompt(
    key: str,
    body: PromptProfileDeleteRequest | None = None,
    context: AdminContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    if key == "general":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="general 配置禁止删除")

    existing = get_prompt_profile(key)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="配置不存在")

    delete_prompt_profile(key)
    version = create_version(
        db,
        profile_key=key,
        payload={"deleted": True, "previous": existing},
        actor=context.actor,
        comment=(body.comment if body else None) or "delete",
    )
    reload_prompt_profiles()
    return {
        "status": "deleted",
        "key": key,
        "version": version.version,
        "actor": context.actor,
    }


@router.post("/prompts/{key}/reset", response_model=PromptProfileResponse)
async def reset_prompt(
    key: str,
    body: PromptProfileRollbackRequest | None = None,
    context: AdminContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PromptProfileResponse:
    default_payload = get_default_prompt_profile(key)
    if default_payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未找到默认配置")
    default_payload = {"key": key, **default_payload}
    profile = save_prompt_profile(default_payload)
    reload_prompt_profiles()
    latest = get_prompt_profile(profile.key)
    assert latest is not None
    version_payload = {"key": profile.key, **latest}
    version = create_version(
        db,
        profile_key=profile.key,
        payload=version_payload,
        actor=context.actor,
        comment=(body.comment if body else None) or "reset to default",
    )
    return _to_response(profile.key, latest, version)


@router.get("/prompts/{key}/versions", response_model=list[PromptProfileVersionResponse])
async def list_prompt_versions(
    key: str,
    _: AdminContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> List[PromptProfileVersionResponse]:
    records = list_versions(db, profile_key=key, limit=100)
    return [
        PromptProfileVersionResponse(
            id=record.id,
            profile_key=record.profile_key,
            version=record.version,
            payload=record.payload,
            actor=record.actor,
            comment=record.comment,
            created_at=record.created_at,
        )
        for record in records
    ]


@router.post("/prompts/{key}/versions/{version_id}/restore", response_model=PromptProfileResponse)
async def restore_prompt_version(
    key: str,
    version_id: str,
    body: PromptProfileRollbackRequest | None = None,
    context: AdminContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PromptProfileResponse:
    record = get_version(db, version_id)
    if record is None or record.profile_key != key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="版本不存在")

    payload = dict(record.payload)
    payload["key"] = key
    profile = save_prompt_profile(payload)
    reload_prompt_profiles()
    latest = get_prompt_profile(profile.key)
    assert latest is not None
    version_payload = {"key": profile.key, **latest}
    version = create_version(
        db,
        profile_key=profile.key,
        payload=version_payload,
        actor=context.actor,
        comment=(body.comment if body else None) or f"restore {record.version}",
    )
    return _to_response(profile.key, latest, version)