from __future__ import annotations

import hashlib
import mimetypes
import os
import uuid
from datetime import datetime, timezone
from typing import Iterable, List, Optional

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
    def __init__(self, db: Session, storage_backend: Optional[StorageBackend] = None) -> None:
        self.db = db
        self.storage = storage_backend or LocalStorageBackend()

    def _normalize_files(self, files: UploadFile | Iterable[UploadFile]) -> List[UploadFile]:
        # `UploadFile` can come from either FastAPI or Starlette in tests.
        if hasattr(files, "filename") and hasattr(files, "file"):
            return [files]
        return list(files or [])

    def create_job(
        self,
        files: UploadFile | List[UploadFile],
        *,
        user_id: Optional[str],
        device_id: Optional[str],
        source: Optional[str] = None,
    ) -> tuple[UploadJob, StorageResult | List[StorageResult]]:
        file_list = self._normalize_files(files)
        if not file_list:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No uploaded files")
        if len(file_list) > MAX_IMAGE_COUNT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Too many files, max allowed is {MAX_IMAGE_COUNT}",
            )

        job_id = str(uuid.uuid4())
        file_metas = []
        binary_payloads = []

        for file in file_list:
            if not file.filename:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing filename")

            extension = os.path.splitext(file.filename)[1].lower()
            if extension not in ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported file type: {extension}",
                )

            file_bytes = file.file.read()
            if not file_bytes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Empty file: {file.filename}",
                )
            file_size = len(file_bytes)
            if file_size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File too large (10MB max): {file.filename}",
                )

            checksum = hashlib.sha256(file_bytes).hexdigest()
            content_type = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
            file_metas.append(
                {
                    "original_name": file.filename,
                    "extension": extension,
                    "size": file_size,
                    "content_type": content_type,
                    "checksum": checksum,
                }
            )
            binary_payloads.append((file_bytes, extension, content_type))

        first_meta = file_metas[0]
        file_meta_payload = {
            "files": file_metas,
            "total_size": sum(item["size"] for item in file_metas),
            # Backward-compatible single-file metadata keys.
            "original_name": first_meta["original_name"],
            "extension": first_meta["extension"],
            "size": first_meta["size"],
            "content_type": first_meta["content_type"],
            "checksum": first_meta["checksum"],
        }

        job = UploadJob(
            id=job_id,
            user_id=user_id,
            device_id=device_id,
            source=source or "unknown",
            status="RECEIVED",
            file_meta=file_meta_payload,
            storage={},
        )
        self.db.add(job)

        storage_results: List[StorageResult] = []
        try:
            single_file_mode = len(binary_payloads) == 1
            for idx, (file_bytes, extension, content_type) in enumerate(binary_payloads):
                target_name = f"{job_id}{extension}" if single_file_mode else f"{job_id}_{idx}{extension}"
                stored = self.storage.store_bytes(
                    file_bytes,
                    filename=target_name,
                    content_type=content_type,
                )
                storage_results.append(stored)
        except Exception:  # noqa: BLE001
            self.db.rollback()
            raise

        job.storage = [
            {
                "location": s.location,
                "path": s.path,
                "bucket": s.bucket,
                "url": s.url,
                "content_type": s.content_type,
                "size": s.size,
            }
            for s in storage_results
        ]
        job.status = "STORED"
        job.updated_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(job)
        if len(storage_results) == 1:
            return job, storage_results[0]
        return job, storage_results

    def get_job(self, job_id: str) -> UploadJob:
        job = self.db.query(UploadJob).filter(UploadJob.id == job_id).first()
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload job not found")
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
