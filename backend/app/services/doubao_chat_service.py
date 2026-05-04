from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, Iterator, List, Optional, Union

from app.core.config import settings
from app.services.doubao_service import DoubaoServiceError, doubao_service

logger = logging.getLogger(__name__)


class DoubaoChatService:
    """Text chat wrapper around the existing Ark client/configuration."""

    def __init__(self) -> None:
        self._vision_service = doubao_service

    def stream_chat(
        self,
        messages: List[Dict[str, Any]],
        *,
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Union[str, Dict[str, Any], None] = "auto",
    ) -> Iterator[Union[str, Dict[str, Any]]]:
        client = self._vision_service._ensure_client()  # noqa: SLF001 - reuse existing configured Ark client.
        request_kwargs: Dict[str, Any] = {
            "model": settings.DOUBAO_MODEL_ID,
            "messages": messages,
            "stream": True,
            "thinking": {"type": settings.DOUBAO_THINKING_MODE or "disabled"},
        }
        if tools:
            request_kwargs["tools"] = tools
            request_kwargs["tool_choice"] = tool_choice or "auto"
            request_kwargs["parallel_tool_calls"] = False
        if settings.DOUBAO_MAX_COMPLETION_TOKENS:
            request_kwargs["max_tokens"] = settings.DOUBAO_MAX_COMPLETION_TOKENS

        try:
            chunks = client.chat.completions.create(**request_kwargs)
            tool_call_chunks: Dict[int, Dict[str, Any]] = {}
            for chunk in chunks:
                delta = self._extract_delta(chunk)
                if delta:
                    yield delta
                for tool_call_chunk in self._extract_tool_call_chunks(chunk):
                    self._accumulate_tool_call_chunk(tool_call_chunks, tool_call_chunk)
            tool_calls = self._finalize_tool_calls(tool_call_chunks)
            if tool_calls:
                yield {"type": "tool_calls", "tool_calls": tool_calls}
        except DoubaoServiceError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("Doubao chat stream failed")
            raise DoubaoServiceError(str(exc)) from exc

    def complete_chat(self, messages: List[Dict[str, Any]], *, max_tokens: Optional[int] = None) -> str:
        client = self._vision_service._ensure_client()  # noqa: SLF001
        request_kwargs: Dict[str, Any] = {
            "model": settings.DOUBAO_MODEL_ID,
            "messages": messages,
            "thinking": {"type": "disabled"},
        }
        if max_tokens:
            request_kwargs["max_tokens"] = max_tokens

        try:
            response = client.chat.completions.create(**request_kwargs)
            payload = self._vision_service._response_to_dict(response)  # noqa: SLF001
            texts = self._vision_service._collect_message_texts(payload)  # noqa: SLF001
            return "\n".join(texts).strip()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Doubao non-stream chat completion failed", exc_info=True)
            raise DoubaoServiceError(str(exc)) from exc

    def generate_title(self, first_message: str) -> str:
        fallback = self._fallback_title(first_message)
        prompt = [
            {"role": "system", "content": "你为学习笔记对话生成简短中文标题。只输出标题，不要解释。"},
            {"role": "user", "content": f"请为这段用户问题生成 6-18 个字的标题：\n{first_message[:500]}"},
        ]
        try:
            title = self.complete_chat(prompt, max_tokens=64).strip().strip('"“”')
        except DoubaoServiceError:
            return fallback
        return title[:80] or fallback

    @staticmethod
    def _fallback_title(first_message: str) -> str:
        clean = " ".join(str(first_message or "").split())
        return (clean[:48] or "新对话")

    @staticmethod
    def _extract_delta(chunk: Any) -> str:
        try:
            choices = getattr(chunk, "choices", None)
            if choices:
                first = choices[0]
                delta = getattr(first, "delta", None)
                content = getattr(delta, "content", None)
                if content:
                    return str(content)
                message = getattr(first, "message", None)
                msg_content = getattr(message, "content", None)
                if msg_content:
                    return str(msg_content)
        except Exception:
            pass

        try:
            if isinstance(chunk, dict):
                choices = chunk.get("choices") or []
                if choices:
                    delta = choices[0].get("delta") or {}
                    content = delta.get("content")
                    if content:
                        return str(content)
        except Exception:
            pass
        return ""

    @staticmethod
    def _extract_tool_call_chunks(chunk: Any) -> List[Any]:
        try:
            choices = getattr(chunk, "choices", None)
            if choices:
                delta = getattr(choices[0], "delta", None)
                tool_calls = getattr(delta, "tool_calls", None)
                if tool_calls:
                    return list(tool_calls)
        except Exception:
            pass

        try:
            if isinstance(chunk, dict):
                choices = chunk.get("choices") or []
                if choices:
                    delta = choices[0].get("delta") or {}
                    tool_calls = delta.get("tool_calls") or []
                    return list(tool_calls)
        except Exception:
            pass
        return []

    @staticmethod
    def _to_plain_dict(value: Any) -> Dict[str, Any]:
        if isinstance(value, dict):
            return value
        model_dump = getattr(value, "model_dump", None)
        if callable(model_dump):
            return model_dump(exclude_none=True)
        result: Dict[str, Any] = {}
        for attr in ("index", "id", "type", "function"):
            attr_value = getattr(value, attr, None)
            if attr_value is not None:
                result[attr] = attr_value
        return result

    @classmethod
    def _accumulate_tool_call_chunk(
        cls,
        accumulator: Dict[int, Dict[str, Any]],
        tool_call_chunk: Any,
    ) -> None:
        data = cls._to_plain_dict(tool_call_chunk)
        raw_index = data.get("index", len(accumulator))
        try:
            index = int(raw_index)
        except (TypeError, ValueError):
            index = len(accumulator)

        current = accumulator.setdefault(
            index,
            {
                "index": index,
                "id": None,
                "type": "function",
                "function": {"name": None, "arguments": ""},
            },
        )
        if data.get("id"):
            current["id"] = str(data["id"])
        if data.get("type"):
            current["type"] = str(data["type"])

        function_data = cls._to_plain_dict(data.get("function") or {})
        if function_data.get("name"):
            current["function"]["name"] = str(function_data["name"])
        if function_data.get("arguments"):
            current["function"]["arguments"] += str(function_data["arguments"])

    @staticmethod
    def _finalize_tool_calls(accumulator: Dict[int, Dict[str, Any]]) -> List[Dict[str, Any]]:
        tool_calls: List[Dict[str, Any]] = []
        for index in sorted(accumulator):
            item = accumulator[index]
            function = item.get("function") or {}
            name = function.get("name")
            if not name:
                continue
            tool_calls.append(
                {
                    "index": index,
                    "id": item.get("id") or f"tool_call_{index}",
                    "type": item.get("type") or "function",
                    "function": {
                        "name": str(name),
                        "arguments": str(function.get("arguments") or ""),
                    },
                }
            )
        return tool_calls


doubao_chat_service = DoubaoChatService()
