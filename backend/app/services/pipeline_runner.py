from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List

from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import SessionLocal
from app.models.upload_job import UploadJob
from app.services.doubao_service import DoubaoServiceError, doubao_service
from app.services.note_service import NoteService
from app.utils.text_cleaning import clean_ocr_text

logger = logging.getLogger(__name__)


async def process_note_job(
    job_id: str,
    *,
    user_id: str,
    device_id: str,
    note_type: str,
    tags: Iterable[str],
) -> None:
    """Run Doubao vision pipeline for a stored upload job."""

    db: Session = SessionLocal()
    try:
        job = db.query(UploadJob).filter(UploadJob.id == job_id).first()
        if not job:
            logger.warning("Upload job %s not found", job_id)
            return

        storage_path = (job.storage or {}).get("path")
        if not storage_path:
            job.append_error({"stage": "DOUBAO", "error": "Missing storage path"})
            _update_status(db, job, "FAILED")
            return

        tag_list = list(tags)

        available, reason = doubao_service.availability_status()
        if not available:
            job.append_error({"stage": "DOUBAO", "error": reason or "Doubao 服务不可用"})
            _update_status(db, job, "FAILED")
            return

        _update_status(db, job, "AI_PENDING")

        try:
            doubao_output = await asyncio.to_thread(
                doubao_service.generate_structured_note,
                [storage_path],
                note_type=note_type,
                tags=tag_list,
            )
        except DoubaoServiceError as exc:
            job.append_error({"stage": "DOUBAO", "error": str(exc)})
            _update_status(db, job, "FAILED")
            return
        except Exception as exc:  # noqa: BLE001
            logger.exception("Doubao pipeline crashed for job %s", job_id)
            job.append_error({"stage": "DOUBAO", "error": str(exc)})
            _update_status(db, job, "FAILED")
            return

        note_payload = doubao_output.get("note") or {}
        raw_text = doubao_output.get("raw_text") or ""
        response_meta = doubao_output.get("response")

        cleaned_text = clean_ocr_text(raw_text) if raw_text else ""

        job.ocr_result = {
            "success": True,
            "provider": "doubao",
            "is_mock": False,
            "text": raw_text,
            "cleaned_text": cleaned_text,
            "response": response_meta,
        }

        note_payload.setdefault("meta", {})
        note_payload["meta"].update(
            {
                "provider": "doubao",
                "response": response_meta,
            }
        )

        job.ai_result = note_payload
        _update_status(db, job, "AI_DONE")

        note_service = NoteService(db)
        saved_note = note_service.create_note(
            {
                "title": note_payload.get("title", "未命名笔记"),
                "original_text": cleaned_text or raw_text,
                "structured_data": note_payload,
                "image_url": (job.storage or {}).get("url"),
                "image_filename": (job.file_meta or {}).get("original_name", ""),
                "image_size": (job.file_meta or {}).get("size", 0),
                "category": note_type,
                "tags": _normalize_tags(tag_list),
            },
            user_id,
            device_id=device_id,
        )

        job.note_id = str(saved_note.id)
        _update_status(db, job, "PERSISTED")
        logger.info("Successfully processed upload job %s", job_id)

        # Cleanup: Delete the uploaded image file
        if storage_path:
            try:
                file_path = Path(storage_path)
                if file_path.exists():
                    file_path.unlink()
                    logger.info("Deleted temporary image file: %s", storage_path)
            except Exception as e:
                logger.warning("Failed to delete image file %s: %s", storage_path, e)

    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected failure while processing job %s", job_id)
        db.rollback()
        job = db.query(UploadJob).filter(UploadJob.id == job_id).first()
        if job:
            job.append_error({"stage": "UNEXPECTED", "error": str(exc)})
            _update_status(db, job, "FAILED")
    finally:
        db.close()


def _update_status(db: Session, job: UploadJob, status: str) -> None:
    """更新 UploadJob 状态

    学习要点:
    - datetime.utcnow() 在 Python 3.12+ 已弃用 (返回 naive datetime)
    - datetime.now(timezone.utc) 返回时区感知的 datetime 对象
    - 统一使用 UTC 时间确保跨时区一致性
    """
    job.status = status
    job.updated_at = datetime.now(timezone.utc)
    db.add(job)
    db.commit()
    db.refresh(job)


async def shutdown_pending_tasks() -> None:  # pragma: no cover - best effort cleanup
    pending = [task for task in asyncio.all_tasks() if not task.done()]
    for task in pending:
        task.cancel()


def _normalize_tags(tags: Iterable[str]) -> List[str]:
    return [tag for tag in (tag.strip() for tag in tags) if tag]
