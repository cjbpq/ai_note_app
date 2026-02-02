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
    original_text: Optional[str] = None
    structured_data: Optional[Dict[str, Any]] = None

class NoteSummary(NoteBase):
    """轻量级笔记模型，用于列表展示（不包含大字段 original_text 和 structured_data）"""
    id: uuid.UUID
    user_id: Optional[str] = None
    device_id: str
    image_url: str
    image_filename: str
    image_size: int
    is_favorite: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class NoteResponse(NoteBase):
    """完整笔记模型，用于详情展示（包含所有字段）"""
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
    notes: List[NoteSummary]
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