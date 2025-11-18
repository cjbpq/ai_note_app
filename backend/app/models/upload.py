from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class UploadResponse(BaseModel):
    id: str
    filename: str
    file_url: str
    file_size: int
    content_type: str
    upload_time: datetime
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