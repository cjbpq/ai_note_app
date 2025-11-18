from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

class NoteBase(BaseModel):
    title: str
    category: Optional[str] = "学习笔记"
    tags: Optional[List[str]] = []

class NoteCreate(NoteBase):
    image_url: str
    image_filename: str
    image_size: int
    original_text: str
    structured_data: Dict[str, Any]

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    is_favorite: Optional[bool] = None

class NoteResponse(NoteBase):
    id: uuid.UUID
    user_id: Optional[str] = None
    device_id: str
    image_url: str
    image_filename: str
    image_size: int
    original_text: str
    structured_data: Dict[str, Any]
    is_favorite: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class NoteListResponse(BaseModel):
    notes: List[NoteResponse]
    total: int

class ExportFormat(BaseModel):
    format: str  # "txt", "md", "pdf", "json"


class NoteGenerationJobResponse(BaseModel):
    job_id: str
    status: str
    detail: Optional[str] = None
    file_url: Optional[str] = None
    queued_at: datetime
    progress_url: Optional[str] = None