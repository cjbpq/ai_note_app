from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

import httpx

from app.core.config import settings


class NexoraDBError(RuntimeError):
    """Raised when the external NexoraDB vector service cannot complete a request."""


@dataclass(frozen=True)
class NexoraDBHit:
    vector_id: str
    text: str
    metadata: Dict[str, Any]
    distance: Optional[float] = None
    score: Optional[float] = None


class NexoraDBClient:
    def __init__(self, *, base_url: Optional[str] = None, api_key: Optional[str] = None, timeout: float = 20.0) -> None:
        self.base_url = (base_url if base_url is not None else settings.NEXORADB_URL or "").rstrip("/")
        self.api_key = api_key if api_key is not None else settings.NEXORADB_API_KEY
        self.timeout = timeout

    @property
    def is_configured(self) -> bool:
        return bool(self.base_url)

    def _headers(self) -> Dict[str, str]:
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    def _url(self, path: str) -> str:
        if not self.base_url:
            raise NexoraDBError("NexoraDB service is not configured")
        return f"{self.base_url}/{path.lstrip('/')}"

    def health(self) -> Dict[str, Any]:
        return self._request("GET", "/health")

    def upsert_texts(self, *, user_id: str, items: Iterable[Dict[str, Any]], library: str = "notes") -> List[str]:
        payload_items = []
        for item in items:
            payload_items.append(
                {
                    "title": item.get("title") or "",
                    "text": item.get("text") or "",
                    "chunk_id": item.get("chunk_id"),
                    "library": item.get("library") or library,
                    "metadata": item.get("metadata") or {},
                }
            )

        if not payload_items:
            return []

        payload = {
            "username": user_id,
            "library": library,
            "items": payload_items,
        }
        data = self._request("POST", "/upsert_texts", json=payload)
        vector_ids = data.get("vector_ids") if isinstance(data, dict) else None
        return [str(item) for item in vector_ids] if isinstance(vector_ids, list) else []

    def query_text(
        self,
        *,
        user_id: str,
        text: str,
        top_k: int,
        where: Optional[Dict[str, Any]] = None,
        library: str = "notes",
    ) -> List[NexoraDBHit]:
        payload: Dict[str, Any] = {
            "username": user_id,
            "text": text,
            "top_k": top_k,
            "library": library,
        }
        if where:
            payload["where"] = where

        data = self._request("POST", "/query_text", json=payload)
        result = data.get("result") if isinstance(data, dict) else {}
        if not isinstance(result, dict):
            return []

        return self._parse_query_result(result)

    def delete(
        self,
        *,
        user_id: str,
        title: Optional[str] = None,
        vector_id: Optional[str] = None,
        where: Optional[Dict[str, Any]] = None,
        library: str = "notes",
    ) -> bool:
        payload: Dict[str, Any] = {
            "username": user_id,
            "library": library,
        }
        if title:
            payload["title"] = title
        if vector_id:
            payload["vector_id"] = vector_id
        if where:
            payload["where"] = where

        data = self._request("POST", "/delete", json=payload)
        return bool(data.get("success")) if isinstance(data, dict) else False

    def delete_note(self, *, user_id: str, note_id: str) -> bool:
        return self.delete(user_id=user_id, where={"note_id": str(note_id)}, library="notes")

    def _request(self, method: str, path: str, **kwargs: Any) -> Dict[str, Any]:
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.request(method, self._url(path), headers=self._headers(), **kwargs)
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPError as exc:
            raise NexoraDBError(str(exc)) from exc
        except ValueError as exc:
            raise NexoraDBError("NexoraDB returned invalid JSON") from exc

        if not isinstance(payload, dict):
            raise NexoraDBError("NexoraDB returned an invalid payload")
        if payload.get("success") is False:
            message = payload.get("message") or "NexoraDB request failed"
            raise NexoraDBError(str(message))
        return payload

    def _parse_query_result(self, result: Dict[str, Any]) -> List[NexoraDBHit]:
        ids = self._first_row(result.get("ids"))
        documents = self._first_row(result.get("documents"))
        metadatas = self._first_row(result.get("metadatas"))
        distances = self._first_row(result.get("distances"))

        count = max(len(ids), len(documents), len(metadatas), len(distances))
        hits: List[NexoraDBHit] = []
        for idx in range(count):
            distance = self._as_float(distances[idx] if idx < len(distances) else None)
            score = None if distance is None else 1.0 / (1.0 + max(0.0, distance))
            metadata = metadatas[idx] if idx < len(metadatas) and isinstance(metadatas[idx], dict) else {}
            hits.append(
                NexoraDBHit(
                    vector_id=str(ids[idx] if idx < len(ids) else ""),
                    text=str(documents[idx] if idx < len(documents) else ""),
                    metadata=metadata,
                    distance=distance,
                    score=score,
                )
            )
        return hits

    @staticmethod
    def _first_row(value: Any) -> List[Any]:
        if isinstance(value, list) and value and isinstance(value[0], list):
            return value[0]
        if isinstance(value, list):
            return value
        return []

    @staticmethod
    def _as_float(value: Any) -> Optional[float]:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None


nexoradb_client = NexoraDBClient()
