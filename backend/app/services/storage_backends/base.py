from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass
class StorageResult:
    location: str
    path: str
    url: str
    bucket: str | None = None
    content_type: str | None = None
    size: int | None = None
    extra: dict[str, Any] | None = None


class StorageBackend(Protocol):
    """Interface for persisting uploaded files."""

    def store_bytes(
        self,
        data: bytes,
        *,
        filename: str,
        content_type: str | None = None,
    ) -> StorageResult:
        ...

    def delete(self, path: str) -> None:
        ...
