import os
import shutil
import uuid
from datetime import datetime

from fastapi import HTTPException, UploadFile

from app.core.config import settings

# Legacy upload helpers used by older endpoints/scripts.
UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def save_upload_file(file: UploadFile, user_id: str = "test_user") -> dict:
    """Save uploaded file and return metadata."""

    file_extension = os.path.splitext(file.filename or "")[1].lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {file_extension}")

    file_id = str(uuid.uuid4())
    filename = f"{file_id}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"File save failed: {exc}") from exc

    file_size = os.path.getsize(file_path)

    return {
        "id": file_id,
        "filename": filename,
        "original_filename": file.filename,
        "file_path": file_path,
        "file_url": f"/static/{filename}",
        "file_size": file_size,
        "content_type": file.content_type,
        "user_id": user_id,
        "upload_time": datetime.now().isoformat(),
    }


def get_file_by_id(file_id: str):
    """Get file metadata by file id."""

    for filename in os.listdir(UPLOAD_DIR):
        if file_id in filename:
            file_path = os.path.join(UPLOAD_DIR, filename)
            return {
                "id": file_id,
                "filename": filename,
                "file_path": file_path,
                "file_url": f"/static/{filename}",
                "file_size": os.path.getsize(file_path),
            }
    return None
