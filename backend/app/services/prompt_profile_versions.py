from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional, Sequence

from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from app.models.prompt_profile_version import PromptProfileVersion


def list_versions(db: Session, *, profile_key: Optional[str] = None, limit: int = 50) -> List[PromptProfileVersion]:
    query = db.query(PromptProfileVersion)
    if profile_key:
        query = query.filter(PromptProfileVersion.profile_key == profile_key)
    return (
        query.order_by(desc(PromptProfileVersion.created_at))
        .limit(limit)
        .all()
    )


def get_version(db: Session, version_id: str) -> Optional[PromptProfileVersion]:
    return db.query(PromptProfileVersion).filter(PromptProfileVersion.id == version_id).one_or_none()


def get_latest_versions_map(db: Session, keys: Sequence[str]) -> Dict[str, PromptProfileVersion]:
    if not keys:
        return {}
    records = (
        db.query(PromptProfileVersion)
        .filter(PromptProfileVersion.profile_key.in_(keys))
        .order_by(asc(PromptProfileVersion.profile_key), desc(PromptProfileVersion.version))
        .all()
    )
    latest: Dict[str, PromptProfileVersion] = {}
    for record in records:
        if record.profile_key not in latest:
            latest[record.profile_key] = record
    return latest


def create_version(
    db: Session,
    *,
    profile_key: str,
    payload: Dict[str, Any],
    actor: Optional[str],
    comment: Optional[str] = None,
) -> PromptProfileVersion:
    latest = (
        db.query(PromptProfileVersion)
        .filter(PromptProfileVersion.profile_key == profile_key)
        .order_by(desc(PromptProfileVersion.version))
        .first()
    )
    next_version = (latest.version if latest else 0) + 1

    record = PromptProfileVersion(
        profile_key=profile_key,
        version=next_version,
        payload=payload,
        actor=actor,
        comment=comment,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def bulk_seed_versions(
    db: Session,
    profiles: Iterable[Dict[str, Any]],
    *,
    actor: Optional[str] = "system",
    comment: Optional[str] = "initial import",
) -> None:
    for profile in profiles:
        key = profile.get("key") or profile.get("profile_key")
        payload = profile.get("payload") or profile
        if not isinstance(payload, dict) or not key:
            continue
        create_version(
            db,
            profile_key=str(key),
            payload=payload,
            actor=actor,
            comment=comment,
        )


def delete_versions(db: Session, profile_key: str) -> None:
    db.query(PromptProfileVersion).filter(PromptProfileVersion.profile_key == profile_key).delete()
    db.commit()
