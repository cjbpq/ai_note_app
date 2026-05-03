from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy.orm import Session

from app.models.chat import NoteVectorChunk
from app.models.note import Note
from app.services.nexoradb_service import NexoraDBClient, NexoraDBError, nexoradb_client

logger = logging.getLogger(__name__)

CHUNK_TARGET_CHARS = 1100
CHUNK_OVERLAP_CHARS = 140
MAX_REBUILD_BATCH_SIZE = 64


@dataclass(frozen=True)
class NoteChunk:
    chunk_id: str
    text: str
    section_heading: Optional[str]
    metadata: Dict[str, Any]
    content_hash: str


class NoteIndexService:
    """Extract note chunks and mirror them into NexoraDB."""

    def __init__(self, db: Session, *, vector_client: Optional[NexoraDBClient] = None) -> None:
        self.db = db
        self.vector_client = vector_client or nexoradb_client

    def extract_chunks(self, note: Note) -> List[NoteChunk]:
        structured = note.structured_data if isinstance(note.structured_data, dict) else {}
        sections = structured.get("sections")
        chunks: List[NoteChunk] = []
        if isinstance(sections, list):
            for idx, section in enumerate(sections):
                if not isinstance(section, dict):
                    continue
                heading = str(section.get("heading") or f"Section {idx + 1}").strip()
                content = self._normalize_text(section.get("content"))
                if not content:
                    continue
                text = self._compose_chunk_text(note, heading=heading, body=content)
                chunks.append(self._build_chunk(note, chunk_id=f"section-{idx + 1}", text=text, heading=heading))

        if chunks:
            return chunks

        original_text = self._normalize_text(note.original_text)
        if not original_text:
            return []

        for idx, text_part in enumerate(self._split_text(original_text), start=1):
            text = self._compose_chunk_text(note, heading=f"原文片段 {idx}", body=text_part)
            chunks.append(self._build_chunk(note, chunk_id=f"text-{idx}", text=text, heading=f"原文片段 {idx}"))
        return chunks

    def index_note(self, note: Note) -> int:
        user_id = str(note.user_id or note.device_id or "").strip()
        if not user_id:
            return 0

        chunks = self.extract_chunks(note)
        existing = {
            row.chunk_id: row
            for row in self.db.query(NoteVectorChunk)
            .filter(NoteVectorChunk.user_id == user_id, NoteVectorChunk.note_id == str(note.id))
            .all()
        }

        desired_ids = {chunk.chunk_id for chunk in chunks}
        stale_rows = [row for chunk_id, row in existing.items() if chunk_id not in desired_ids]
        for row in stale_rows:
            self.db.delete(row)

        items_to_upsert = []
        chunks_to_upsert: List[NoteChunk] = []
        for chunk in chunks:
            row = existing.get(chunk.chunk_id)
            if row and row.content_hash == chunk.content_hash:
                continue
            items_to_upsert.append(
                {
                    "title": str(note.id),
                    "text": chunk.text,
                    "chunk_id": chunk.chunk_id,
                    "library": "notes",
                    "metadata": chunk.metadata,
                }
            )
            chunks_to_upsert.append(chunk)

        vector_ids: List[str] = []
        if items_to_upsert:
            if not self.vector_client.is_configured:
                raise NexoraDBError("NexoraDB service is not configured")
            vector_ids = self.vector_client.upsert_texts(user_id=user_id, items=items_to_upsert, library="notes")

        now = datetime.now(timezone.utc)
        for idx, chunk in enumerate(chunks_to_upsert):
            row = existing.get(chunk.chunk_id)
            if row is None:
                row = NoteVectorChunk(
                    user_id=user_id,
                    note_id=str(note.id),
                    chunk_id=chunk.chunk_id,
                )
                self.db.add(row)
            row.vector_id = vector_ids[idx] if idx < len(vector_ids) else row.vector_id
            row.content_hash = chunk.content_hash
            row.section_heading = chunk.section_heading
            row.content = chunk.text
            row.chunk_metadata = chunk.metadata
            row.updated_at = now

        self.db.commit()
        return len(chunks)

    def delete_note_index(self, *, user_id: str, note_id: str) -> None:
        rows = (
            self.db.query(NoteVectorChunk)
            .filter(NoteVectorChunk.user_id == user_id, NoteVectorChunk.note_id == str(note_id))
            .all()
        )
        if self.vector_client.is_configured:
            try:
                self.vector_client.delete_note(user_id=user_id, note_id=str(note_id))
            except NexoraDBError:
                logger.warning("Failed to delete NexoraDB chunks for note %s", note_id, exc_info=True)

        for row in rows:
            self.db.delete(row)
        self.db.commit()

    def rebuild_user_index(self, *, user_id: str, batch_size: int = MAX_REBUILD_BATCH_SIZE) -> Dict[str, int]:
        safe_limit = min(max(1, int(batch_size or MAX_REBUILD_BATCH_SIZE)), MAX_REBUILD_BATCH_SIZE)
        notes = (
            self.db.query(Note)
            .filter(Note.user_id == user_id, Note.is_archived.is_(False))
            .order_by(Note.updated_at.asc())
            .limit(safe_limit)
            .all()
        )
        indexed_notes = 0
        indexed_chunks = 0
        skipped_notes = 0
        for note in notes:
            try:
                count = self.index_note(note)
                indexed_notes += 1
                indexed_chunks += count
            except NexoraDBError:
                skipped_notes += 1
                logger.warning("Skipping note %s during index rebuild", note.id, exc_info=True)
        return {
            "indexed_notes": indexed_notes,
            "indexed_chunks": indexed_chunks,
            "skipped_notes": skipped_notes,
        }

    def _build_chunk(self, note: Note, *, chunk_id: str, text: str, heading: Optional[str]) -> NoteChunk:
        metadata = {
            "source": "ai_note_app",
            "note_id": str(note.id),
            "chunk_id": chunk_id,
            "section_heading": heading or "",
            "title": note.title,
            "category": note.category or "",
            "tags": note.tags or [],
            "updated_at": note.updated_at.isoformat() if note.updated_at else "",
        }
        return NoteChunk(
            chunk_id=chunk_id,
            text=text,
            section_heading=heading,
            metadata=metadata,
            content_hash=self._hash_text(text),
        )

    def _compose_chunk_text(self, note: Note, *, heading: str, body: str) -> str:
        tags = "、".join(note.tags or [])
        summary = ""
        if isinstance(note.structured_data, dict):
            summary = str(note.structured_data.get("summary") or "").strip()
        parts = [
            f"标题: {note.title}",
            f"分类: {note.category or ''}",
            f"标签: {tags}",
        ]
        if summary:
            parts.append(f"摘要: {summary}")
        if heading:
            parts.append(f"章节: {heading}")
        parts.append(f"内容:\n{body}")
        return "\n".join(parts).strip()

    @classmethod
    def _split_text(cls, text: str) -> Iterable[str]:
        clean = cls._normalize_text(text)
        if len(clean) <= CHUNK_TARGET_CHARS:
            yield clean
            return

        start = 0
        length = len(clean)
        while start < length:
            end = min(length, start + CHUNK_TARGET_CHARS)
            yield clean[start:end].strip()
            if end >= length:
                break
            start = max(0, end - CHUNK_OVERLAP_CHARS)

    @staticmethod
    def _normalize_text(value: Any) -> str:
        text = str(value or "").replace("\r\n", "\n").replace("\r", "\n")
        return "\n".join(line.strip() for line in text.splitlines() if line.strip()).strip()

    @staticmethod
    def _hash_text(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()


def try_index_note(db: Session, note: Note) -> None:
    try:
        NoteIndexService(db).index_note(note)
    except NexoraDBError:
        logger.warning("Note %s was saved but indexing failed", note.id, exc_info=True)


def try_delete_note_index(db: Session, *, user_id: str, note_id: str) -> None:
    try:
        NoteIndexService(db).delete_note_index(user_id=user_id, note_id=note_id)
    except NexoraDBError:
        logger.warning("Failed to delete index for note %s", note_id, exc_info=True)
