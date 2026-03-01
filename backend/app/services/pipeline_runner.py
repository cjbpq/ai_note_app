from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Iterable, List

from sqlalchemy.orm import Session

from app.core.config import settings  # backward-compatible export for legacy tests
from app.database import SessionLocal
from app.models.upload_job import UploadJob
from app.services.doubao_service import DoubaoServiceError, doubao_service
from app.services.note_service import NoteService
from app.utils.text_cleaning import clean_ocr_text

logger = logging.getLogger(__name__)


def _normalize_storage_entries(storage_data: Any) -> list[dict]:
    if isinstance(storage_data, dict):
        return [storage_data]
    if isinstance(storage_data, list):
        return [entry for entry in storage_data if isinstance(entry, dict)]
    return []


async def process_note_job(
    job_id: str,
    *,
    user_id: str,
    device_id: str,
    note_type: str,
    tags: Iterable[str],
) -> None:
    db: Session = SessionLocal()
    try:
        job = db.query(UploadJob).filter(UploadJob.id == job_id).first()
        if not job:
            logger.warning("Upload job %s not found", job_id)
            return

        storage_entries = _normalize_storage_entries(job.storage or [])
        storage_paths = [entry.get("path") for entry in storage_entries if entry.get("path")]
        if not storage_paths:
            job.append_error({"stage": "DOUBAO", "error": "Missing storage path"})
            _update_status(db, job, "FAILED")
            return

        tag_list = list(tags)
        available, reason = doubao_service.availability_status()
        if not available:
            job.append_error({"stage": "DOUBAO", "error": reason or "Doubao service unavailable"})
            _update_status(db, job, "FAILED")
            return

        _update_status(db, job, "AI_PENDING")
        try:
            doubao_output = await asyncio.to_thread(
                doubao_service.generate_structured_note,
                storage_paths,
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
        note_payload["meta"].update({"provider": "doubao", "response": response_meta})
        job.ai_result = note_payload
        _update_status(db, job, "AI_DONE")

        file_metas = (job.file_meta or {}).get("files", [])
        note_service = NoteService(db)
        saved_note = note_service.create_note(
            {
                "title": note_payload.get("title", "Untitled note"),
                "original_text": cleaned_text or raw_text,
                "structured_data": note_payload,
                "image_urls": [entry.get("url", "") for entry in storage_entries],
                "image_filenames": [meta.get("original_name", "") for meta in file_metas],
                "image_sizes": [meta.get("size", 0) for meta in file_metas],
                "category": note_type,
                "tags": _normalize_tags(tag_list),
            },
            user_id,
            device_id=device_id,
        )

        job.note_id = str(saved_note.id)
        _update_status(db, job, "PERSISTED")
        logger.info("Successfully processed upload job %s", job_id)
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
    job.status = status
    job.updated_at = datetime.now(timezone.utc)
    db.add(job)
    db.commit()
    db.refresh(job)


async def shutdown_pending_tasks() -> None:  # pragma: no cover
    pending = [task for task in asyncio.all_tasks() if not task.done()]
    for task in pending:
        task.cancel()


def _normalize_tags(tags: Iterable[str]) -> List[str]:
    return [tag for tag in (item.strip() for item in tags) if tag]
