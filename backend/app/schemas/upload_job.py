from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field

from app.utils.datetime_fmt import LocalDatetime


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


class FileMetaList(BaseModel):
    """多文件上传时的文件元数据列表"""
    files: List[FileMeta]
    total_size: int


class UploadJobBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    source: Optional[str] = None
    file_meta: Union[FileMeta, FileMetaList, Dict[str, Any]]
    storage: Union[StorageInfo, List[StorageInfo], Dict[str, Any]]
    user_id: Optional[str] = None
    device_id: Optional[str] = None
    note_id: Optional[str] = None
    created_at: LocalDatetime
    updated_at: LocalDatetime


class UploadJobResponse(UploadJobBase):
    ocr_result: Optional[Dict[str, Any]] = None
    ai_result: Optional[Dict[str, Any]] = None
    error_logs: Optional[List[Dict[str, Any]]] = None


class CreateUploadJobResponse(BaseModel):
    job: UploadJobResponse
    file_urls: Optional[List[str]] = None
