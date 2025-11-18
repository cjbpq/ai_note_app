from __future__ import annotations

import hashlib
import mimetypes
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.upload_job import UploadJob
from app.services.storage_backends import LocalStorageBackend, StorageBackend, StorageResult

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


class InputPipelineService:
    """负责管理上传阶段的任务创建、文件存储与元数据维护。"""

    def __init__(self, db: Session, storage_backend: Optional[StorageBackend] = None) -> None:
        self.db = db
        self.storage = storage_backend or LocalStorageBackend()

    def create_job(
        self,
        file: UploadFile,
        *,
        user_id: Optional[str],
        device_id: Optional[str],
        source: Optional[str] = None,
    ) -> tuple[UploadJob, StorageResult]:
        if not file.filename:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="上传文件缺少文件名")

        extension = os.path.splitext(file.filename)[1].lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"不支持的文件类型: {extension}")

        file_bytes = file.file.read()
        if not file_bytes:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="上传文件为空")

        file_size = len(file_bytes)
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="文件大小超出限制 (10MB)")

        checksum = hashlib.sha256(file_bytes).hexdigest()
        file.file.seek(0)

        content_type = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
        job_id = str(uuid.uuid4())

        job = UploadJob(
            id=job_id,
            user_id=user_id,
            device_id=device_id,
            source=source or "unknown",
            status="RECEIVED",
            file_meta={
                "original_name": file.filename,
                "extension": extension,
                "size": file_size,
                "content_type": content_type,
                "checksum": checksum,
            },
            storage={},
        )

        self.db.add(job)

        try:
            storage_result = self.storage.store_bytes(
                file_bytes,
                filename=f"{job_id}{extension}",
                content_type=content_type,
            )
        except Exception:
            self.db.rollback()
            raise

        job.storage = {
            "location": storage_result.location,
            "path": storage_result.path,
            "bucket": storage_result.bucket,
            "url": storage_result.url,
            "content_type": storage_result.content_type,
            "size": storage_result.size,
        }
        job.status = "STORED"
        # 学习要点: 使用 timezone-aware datetime 替代 naive datetime
        # datetime.utcnow() 在 Python 3.12+ 已弃用
        # datetime.now(timezone.utc) 返回带时区信息的 datetime, 避免时区转换错误
        job.updated_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(job)

        return job, storage_result

    def get_job(self, job_id: str) -> UploadJob:
        job = self.db.query(UploadJob).filter(UploadJob.id == job_id).first()
        if not job:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="上传任务不存在")
        return job

    def list_jobs(self, user_id: Optional[str] = None, status_filter: Optional[str] = None) -> list[UploadJob]:
        query = self.db.query(UploadJob)
        if user_id:
            query = query.filter(UploadJob.user_id == user_id)
        if status_filter:
            query = query.filter(UploadJob.status == status_filter)
        return query.order_by(UploadJob.created_at.desc()).all()
