from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String
from sqlalchemy.sql import func

from app.database import Base


class AdminKeyBinding(Base):
    __tablename__ = "admin_key_bindings"

    key_fingerprint = Column(String(128), primary_key=True)
    actor = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self) -> str:
        return f"<AdminKeyBinding key={self.key_fingerprint} actor={self.actor}>"
