from __future__ import annotations

import uuid
from typing import Any, Dict

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

UPLOAD_JOB_STATUSES = (
    "RECEIVED",
    "STORED",
    "QUEUED",
    "OCR_PENDING",
    "OCR_DONE",
    "AI_PENDING",
    "AI_DONE",
    "PERSISTED",
    "FAILED",
)


class UploadJob(Base):
    __tablename__ = "upload_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    device_id = Column(String(64), nullable=True, index=True)
    source = Column(String(32), nullable=True, default="unknown")
    status = Column(String(32), nullable=False, default="RECEIVED")
    file_meta = Column(JSON, nullable=False, default=dict)
    storage = Column(JSON, nullable=False, default=dict)
    ocr_result = Column(JSON, nullable=True)
    ai_result = Column(JSON, nullable=True)
    error_logs = Column(JSON, nullable=True)
    note_id = Column(String(36), ForeignKey("notes.id"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="upload_jobs")
    note = relationship("Note", backref="upload_jobs")

    def append_error(self, error: Dict[str, Any]) -> None:
        logs = self.error_logs or []
        logs.append(error)
        self.error_logs = logs
