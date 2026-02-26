from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.utils.datetime_fmt import LocalDatetime

class UploadFileInfo(BaseModel):
    filename: str
    file_url: str
    file_size: int
    content_type: str

class UploadResponse(BaseModel):
    id: str
    files: List[UploadFileInfo]
    upload_time: LocalDatetime
    progress_url: Optional[str] = None

class OCRResult(BaseModel):
    success: bool
    text: str
    confidence: float
    language: str
    cleaned_text: Optional[str] = None
    error: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None

class UploadWithOCRResponse(BaseModel):
    upload_info: UploadResponse
    ocr_result: OCRResult