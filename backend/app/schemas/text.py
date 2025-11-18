from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class TextExtractionResponse(BaseModel):
    text: str
    cleaned_text: Optional[str] = None
    format: str = "markdown"
    file_url: str
    provider: str = "doubao"
    response: Optional[dict[str, Any]] = None


__all__ = ["TextExtractionResponse"]
