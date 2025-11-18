import uuid
from typing import Any, Dict

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.database import Base


class Note(Base):
    """笔记模型，存储 AI 生成的结构化内容"""

    __tablename__ = "notes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    device_id = Column(String(64), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True, default="学习笔记")
    tags = Column(JSON, nullable=False, default=list)
    image_url = Column(String(2048), nullable=False)
    image_filename = Column(String(255), nullable=False)
    image_size = Column(Integer, nullable=False)
    original_text = Column(Text, nullable=False)
    structured_data = Column(JSON, nullable=False, default=dict)
    is_favorite = Column(Boolean, nullable=False, default=False)
    is_archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<Note(id={self.id}, title={self.title!r})>"

    def to_dict(self) -> Dict[str, Any]:
        """转换为可序列化的字典"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "device_id": self.device_id,
            "title": self.title,
            "category": self.category,
            "tags": self.tags or [],
            "image_url": self.image_url,
            "image_filename": self.image_filename,
            "image_size": self.image_size,
            "original_text": self.original_text,
            "structured_data": self.structured_data or {},
            "is_favorite": self.is_favorite,
            "is_archived": self.is_archived,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
