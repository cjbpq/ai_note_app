from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class StorageInfo(BaseModel):
    location: str = Field(default="local", description="存储类型：local/oss/...")
    path: str
    bucket: Optional[str] = None
    url: Optional[str] = None
    expires_at: Optional[datetime] = None


class FileMeta(BaseModel):
    original_name: str
    extension: str
    size: int
    content_type: str
    checksum: str
    width: Optional[int] = None
    height: Optional[int] = None


class UploadJobBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    source: Optional[str] = None
    file_meta: FileMeta
    storage: StorageInfo
    user_id: Optional[str] = None
    device_id: Optional[str] = None
    note_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class UploadJobResponse(UploadJobBase):
    ocr_result: Optional[Dict[str, Any]] = None
    ai_result: Optional[Dict[str, Any]] = None
    error_logs: Optional[List[Dict[str, Any]]] = None


class CreateUploadJobResponse(BaseModel):
    job: UploadJobResponse
    file_url: Optional[str] = None
