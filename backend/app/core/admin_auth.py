from __future__ import annotations

from dataclasses import dataclass
import hashlib
import re
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.services.admin_key_binding import create_binding, get_binding


@dataclass(frozen=True)
class AdminContext:
    actor: str
    key_fingerprint: str


async def get_admin_context(
    x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
    x_admin_actor: Optional[str] = Header(default=None, alias="X-Admin-Actor"),
    db: Session = Depends(get_db),
) -> AdminContext:
    expected_key = settings.ADMIN_PORTAL_API_KEY
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin portal 未启用，缺少 ADMIN_PORTAL_API_KEY 配置。",
        )

    if not x_admin_key or x_admin_key.strip() != expected_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的管理员密钥")

    if not x_admin_actor or not x_admin_actor.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="X-Admin-Actor 不能为空")

    actor = x_admin_actor.strip()
    if not re.fullmatch(r"[A-Za-z0-9\u4e00-\u9fa5]+", actor):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="X-Admin-Actor 仅允许中文、英文或数字")

    key_fingerprint = hashlib.sha256(expected_key.encode("utf-8")).hexdigest()
    binding = get_binding(db, key_fingerprint)
    if binding is None:
        create_binding(db, key_fingerprint, actor)
    elif binding.actor != actor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"该密钥已绑定操作员 {binding.actor}",
        )

    return AdminContext(actor=actor, key_fingerprint=key_fingerprint)


def require_admin(context: AdminContext = Depends(get_admin_context)) -> AdminContext:
    return context
