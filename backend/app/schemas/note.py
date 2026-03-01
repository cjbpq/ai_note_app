from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
import uuid

from pydantic import BaseModel, Field

from app.utils.datetime_fmt import LocalDatetime


class NoteBase(BaseModel):
    title: str
    category: Optional[str] = "学习笔记"
    tags: Optional[List[str]] = []


class NoteCreate(NoteBase):
    image_urls: List[str]
    image_filenames: List[str]
    image_sizes: List[int]
    original_text: str
    structured_data: Dict[str, Any]


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    is_favorite: Optional[bool] = None
    original_text: Optional[str] = None
    structured_data: Optional[Dict[str, Any]] = None


class NoteSummary(NoteBase):
    id: uuid.UUID
    user_id: Optional[str] = None
    device_id: str
    image_urls: List[str]
    image_filenames: List[str]
    image_sizes: List[int]
    is_favorite: bool
    is_archived: bool
    created_at: LocalDatetime
    updated_at: LocalDatetime

    class Config:
        from_attributes = True


class NoteResponse(NoteBase):
    id: uuid.UUID
    user_id: Optional[str] = None
    device_id: str
    image_urls: List[str]
    image_filenames: List[str]
    image_sizes: List[int]
    original_text: str
    structured_data: Dict[str, Any]
    is_favorite: bool
    is_archived: bool
    created_at: LocalDatetime
    updated_at: LocalDatetime

    class Config:
        from_attributes = True


class NoteListResponse(BaseModel):
    notes: List[NoteSummary]
    total: int


class ExportFormat(BaseModel):
    format: str  # "txt", "md", "pdf", "json"


class NoteGenerationJobResponse(BaseModel):
    job_id: str
    status: str
    detail: Optional[str] = None
    file_urls: Optional[List[str]] = None
    queued_at: LocalDatetime
    progress_url: Optional[str] = None


class NoteSyncResponse(BaseModel):
    updated: List[NoteSummary]
    deleted_ids: List[str]
    server_time: datetime


class NoteBatchRequest(BaseModel):
    note_ids: List[uuid.UUID] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="IDs to fetch in one batch",
    )


class NoteBatchResponse(BaseModel):
    notes: List[NoteResponse]
    total: int


class NoteMutationItem(BaseModel):
    """Offline mutation task uploaded by client after reconnect."""

    op_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Client mutation id used for request/result correlation",
    )
    type: Literal["update_note", "set_favorite", "delete_note"]
    note_id: uuid.UUID
    patch: Optional[NoteUpdate] = None
    is_favorite: Optional[bool] = None


class NoteMutationBatchRequest(BaseModel):
    mutations: List[NoteMutationItem] = Field(..., min_length=1, max_length=100)


class NoteMutationResult(BaseModel):
    op_id: str
    type: str
    note_id: uuid.UUID
    status: Literal["applied", "not_found", "invalid", "failed"]
    code: int
    message: Optional[str] = None
    updated_at: Optional[datetime] = None


class NoteMutationBatchResponse(BaseModel):
    results: List[NoteMutationResult]
    applied_count: int
    failed_count: int
    server_time: datetime
