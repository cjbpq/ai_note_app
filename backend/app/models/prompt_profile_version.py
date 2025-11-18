import uuid
from typing import Any, Dict

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.database import Base


class PromptProfileVersion(Base):
    __tablename__ = "prompt_profile_versions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    profile_key = Column(String(100), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    payload = Column(JSON, nullable=False)
    actor = Column(String(100), nullable=True)
    comment = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "profile_key": self.profile_key,
            "version": self.version,
            "payload": self.payload,
            "actor": self.actor,
            "comment": self.comment,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
