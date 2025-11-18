from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.admin_key_binding import AdminKeyBinding


def _ensure_table(db: Session) -> None:
    AdminKeyBinding.__table__.create(bind=db.get_bind(), checkfirst=True)


def get_binding(db: Session, key_fingerprint: str) -> Optional[AdminKeyBinding]:
    _ensure_table(db)
    return db.query(AdminKeyBinding).filter(AdminKeyBinding.key_fingerprint == key_fingerprint).one_or_none()


def create_binding(db: Session, key_fingerprint: str, actor: str) -> AdminKeyBinding:
    _ensure_table(db)
    record = AdminKeyBinding(key_fingerprint=key_fingerprint, actor=actor)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def delete_binding(db: Session, key_fingerprint: str) -> None:
    _ensure_table(db)
    db.query(AdminKeyBinding).filter(AdminKeyBinding.key_fingerprint == key_fingerprint).delete()
    db.commit()
