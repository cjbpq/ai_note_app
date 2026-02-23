from __future__ import annotations

import hashlib
import mimetypes
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.upload_job import UploadJob
from app.services.storage_backends import LocalStorageBackend, StorageBackend, StorageResult

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB per file
MAX_IMAGE_COUNT = 10
MAX_CONCURRENT_NOTE_JOBS_PER_USER = 10
TERMINAL_JOB_STATUSES = {"FAILED", "PERSISTED"}


class InputPipelineService:
    """负责管理上传阶段的任务创建、文件存储与元数据维护。"""

    def __init__(self, db: Session, storage_backend: Optional[StorageBackend] = None) -> None:
        self.db = db
        self.storage = storage_backend or LocalStorageBackend()

    def create_job(
        self,
        files: List[UploadFile],
        *,
        user_id: Optional[str],
        device_id: Optional[str],
        source: Optional[str] = None,
    ) -> tuple[UploadJob, List[StorageResult]]:
        if not files:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="没有上传文件")

        if len(files) > MAX_IMAGE_COUNT:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="传入图片请小于或等于10张")

        job_id = str(uuid.uuid4())
        file_metas = []
        all_file_bytes = []

        for file in files:
            if not file.filename:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="上传文件缺少文件名")

            extension = os.path.splitext(file.filename)[1].lower()
            if extension not in ALLOWED_EXTENSIONS:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"不支持的文件类型: {extension}")

            file_bytes = file.file.read()
            if not file_bytes:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"上传文件为空: {file.filename}")

            file_size = len(file_bytes)
            if file_size > MAX_FILE_SIZE:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"文件大小超出限制 (10MB): {file.filename}")

            checksum = hashlib.sha256(file_bytes).hexdigest()
            content_type = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"

            file_metas.append({
                "original_name": file.filename,
                "extension": extension,
                "size": file_size,
                "content_type": content_type,
                "checksum": checksum,
            })
            all_file_bytes.append((file_bytes, extension, content_type))

        job = UploadJob(
            id=job_id,
            user_id=user_id,
            device_id=device_id,
            source=source or "unknown",
            status="RECEIVED",
            file_meta={"files": file_metas, "total_size": sum(m["size"] for m in file_metas)},
            storage={},
        )

        self.db.add(job)

        storage_results = []
        try:
            for idx, (file_bytes, extension, content_type) in enumerate(all_file_bytes):
                storage_result = self.storage.store_bytes(
                    file_bytes,
                    filename=f"{job_id}_{idx}{extension}",
                    content_type=content_type,
                )
                storage_results.append(storage_result)
        except Exception:
            self.db.rollback()
            raise

        job.storage = [
            {
                "location": sr.location,
                "path": sr.path,
                "bucket": sr.bucket,
                "url": sr.url,
                "content_type": sr.content_type,
                "size": sr.size,
            }
            for sr in storage_results
        ]
        job.status = "STORED"
        job.updated_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(job)

        return job, storage_results

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

    def count_active_jobs(self, *, user_id: str, source: Optional[str] = None) -> int:
        query = self.db.query(UploadJob).filter(
            UploadJob.user_id == user_id,
            UploadJob.status.notin_(TERMINAL_JOB_STATUSES),
        )
        if source:
            query = query.filter(UploadJob.source == source)
        return query.count()
