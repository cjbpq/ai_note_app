from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

from .base import StorageBackend, StorageResult

UPLOAD_DIR = Path("uploaded_images")
UPLOAD_DIR.mkdir(exist_ok=True)


class LocalStorageBackend(StorageBackend):
    """Persist uploads to the local filesystem."""

    def __init__(self, base_dir: Optional[os.PathLike[str]] = None, public_prefix: str = "/static/") -> None:
        self.base_dir = Path(base_dir) if base_dir else UPLOAD_DIR
        self.public_prefix = public_prefix.rstrip("/") + "/"
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def store_bytes(
        self,
        data: bytes,
        *,
        filename: str,
        content_type: str | None = None,
    ) -> StorageResult:
        try:
            target_path = self.base_dir / filename
            with open(target_path, "wb") as buffer:
                buffer.write(data)
        except OSError as exc:
            raise HTTPException(status_code=500, detail=f"文件保存失败: {exc}") from exc

        url = f"{self.public_prefix}{filename}"
        return StorageResult(
            location="local",
            path=str(target_path),
            url=url,
            content_type=content_type,
            size=len(data),
        )

    def delete(self, path: str) -> None:
        try:
            os.remove(path)
        except FileNotFoundError:
            return
        except OSError:
            return
