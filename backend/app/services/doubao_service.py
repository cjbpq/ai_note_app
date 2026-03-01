from __future__ import annotations

import base64
import json
import logging
import mimetypes
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from app.core.config import settings
from app.services.prompt_profiles import PromptProfile, resolve_prompt_profile

logger = logging.getLogger(__name__)

try:  # pragma: no cover - optional dependency
    from volcenginesdkarkruntime import Ark  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
    Ark = None  # type: ignore


IMAGE_MIME_DEFAULT = "image/png"
SUPPORTED_DETAIL_VALUES = {"low", "high", "auto"}
TEXT_EXTRACTION_FORMATS = {"markdown", "plain_text"}


class DoubaoServiceError(RuntimeError):
    """Raised when the Doubao service cannot fulfil a request."""


class DoubaoVisionService:
    """Thin wrapper around Doubao Responses API for vision → structured note tasks."""

    def __init__(self) -> None:
        self._client: Optional[Any] = None
        self._model_catalog_cache: Dict[str, Dict[str, Any]] = {}
        self._model_catalog_loaded = False

    @property
    def is_available(self) -> bool:
        available, _ = self.availability_status()
        return available

    def availability_status(self) -> Tuple[bool, Optional[str]]:
        if Ark is None:
            return False, "缺少 Doubao Ark SDK。请在当前虚拟环境中运行 pip install \"volcengine-python-sdk[ark]\"。"
        has_api_key = bool(settings.DOUBAO_API_KEY)
        has_ak_sk = bool(settings.DOUBAO_ACCESS_KEY_ID and settings.DOUBAO_SECRET_ACCESS_KEY)
        if not (has_api_key or has_ak_sk):
            return False, "未检测到 DOUBAO_API_KEY/ARK_API_KEY 或 VOLC_ACCESSKEY/VOLC_SECRETKEY 环境变量。"
        return True, None

    def _ensure_client(self) -> Any:
        if not self.is_available:
            available, reason = self.availability_status()
            message = reason or "Doubao SDK not installed or API key missing"
            raise DoubaoServiceError(message)

        if self._client is None:
            api_key = settings.DOUBAO_API_KEY or None
            ak = settings.DOUBAO_ACCESS_KEY_ID or None
            sk = settings.DOUBAO_SECRET_ACCESS_KEY or None
            self._client = Ark(
                base_url=settings.DOUBAO_BASE_URL,
                api_key=api_key,
                ak=ak,
                sk=sk,
            )
        return self._client

    def generate_structured_note(
        self,
        image_paths: Iterable[str],
        *,
        note_type: str,
        tags: Optional[Iterable[str]] = None,
        detail: Optional[str] = None,
        max_completion_tokens: Optional[int] = None,
        thinking: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send images to Doubao and request a structured learning note JSON."""

        if detail and detail not in SUPPORTED_DETAIL_VALUES:
            raise ValueError(f"Unsupported detail level '{detail}'")

        client = self._ensure_client()
        tag_list = list(tags or [])
        profile = self._resolve_profile(note_type)
        system_prompt, user_prompt = profile.render_prompts(note_type=note_type, tags=tag_list)

        image_contents = [self._encode_image(path, detail=detail) for path in image_paths]

        input_payload = [
            {
                "role": "system",
                "content": [
                    {"type": "text", "text": system_prompt},
                ],
            },
            {
                "role": "user",
                "content": [
                    *image_contents,
                    {"type": "text", "text": user_prompt},
                ],
            },
        ]

        schema_payload = profile.schema_payload() if settings.DOUBAO_USE_JSON_SCHEMA else None

        request_kwargs: Dict[str, Any] = {
            "model": settings.DOUBAO_MODEL_ID,
            "messages": input_payload,
        }

        # 根据模型能力自动选择官方支持的结构化输出格式。
        if schema_payload:
            response_format = self._build_response_format(
                model_id=settings.DOUBAO_MODEL_ID,
                schema_payload=schema_payload,
            )
            if response_format:
                request_kwargs["response_format"] = response_format

        # 控制思考模式（根据官方文档直接传递 thinking 参数）
        thinking_type = thinking or settings.DOUBAO_THINKING_MODE or "disabled"
        request_kwargs["thinking"] = {"type": thinking_type}

        tokens_limit = max_completion_tokens or settings.DOUBAO_MAX_COMPLETION_TOKENS
        if tokens_limit:
            request_kwargs["max_tokens"] = tokens_limit

        sanitized_kwargs = {k: v for k, v in request_kwargs.items() if v is not None}
        used_response_format = "response_format" in sanitized_kwargs

        try:
            response = client.chat.completions.create(**sanitized_kwargs)
        except Exception as exc:  # noqa: BLE001
            if used_response_format and self._is_json_schema_unsupported(exc):
                logger.warning(
                    "Model %s does not support response_format=json_schema, retrying without schema",
                    settings.DOUBAO_MODEL_ID,
                )
                fallback_kwargs = dict(sanitized_kwargs)
                fallback_kwargs.pop("response_format", None)
                try:
                    response = client.chat.completions.create(**fallback_kwargs)
                except Exception as retry_exc:  # noqa: BLE001
                    logger.exception("Doubao request failed after retry without json_schema")
                    raise DoubaoServiceError(str(retry_exc)) from retry_exc
            else:
                logger.exception("Doubao request failed")
                raise DoubaoServiceError(str(exc)) from exc

        response_payload = self._response_to_dict(response)
        note_payload, raw_text = self._extract_note_payload(response_payload)

        note_meta = note_payload.setdefault("meta", {})
        note_meta.setdefault("subject", profile.display_name)
        note_meta.setdefault("prompt_profile", profile.key)
        note_meta.setdefault("tags", tag_list)
        note_meta.setdefault("original_note_type", note_type)

        return {
            "note": note_payload,
            "raw_text": raw_text,
            "response": response_payload,
        }

    def generate_plain_text(
        self,
        image_paths: Iterable[str],
        *,
        detail: Optional[str] = None,
        output_format: str = "markdown",
    ) -> Dict[str, Any]:
        if output_format not in TEXT_EXTRACTION_FORMATS:
            raise ValueError(f"Unsupported output_format '{output_format}'")

        client = self._ensure_client()
        image_contents = [self._encode_image(path, detail=detail) for path in image_paths]

        format_instruction = (
            "请输出结构化的 Markdown，使用标题、列表和表格来表达层次，保持与图片相同的顺序。"
            if output_format == "markdown"
            else "请输出纯文本，保持原有换行与缩进，移除多余噪声。"
        )

        system_prompt = (
            "你是一名精准的文字整理助手。"
            "需要严格按照图片的排版顺序提取文字，保留换行、项目符号和关键信息。"
            "避免臆测或自作主张添加内容，如无法识别请明确标注。"
        )

        user_prompt = (
            "请逐页阅读所有图片，依次输出整理后的文本。"
            f"{format_instruction}"
            "如遇到表格，可使用 Markdown 表格或清单重新排版。"
            "若有无法辨认的内容，使用【无法识别】标记。"
        )

        input_payload = [
            {
                "role": "system",
                "content": [
                    {"type": "text", "text": system_prompt},
                ],
            },
            {
                "role": "user",
                "content": [
                    *image_contents,
                    {"type": "text", "text": user_prompt},
                ],
            },
        ]

        request_kwargs: Dict[str, Any] = {
            "model": settings.DOUBAO_MODEL_ID,
            "messages": input_payload,
        }

        # 禁用思考模式（根据官方文档直接传递 thinking 参数）
        request_kwargs["thinking"] = {"type": "disabled"}

        tokens_limit = settings.DOUBAO_MAX_COMPLETION_TOKENS
        if tokens_limit:
            request_kwargs["max_tokens"] = tokens_limit

        try:
            response = client.chat.completions.create(**{k: v for k, v in request_kwargs.items() if v is not None})
        except Exception as exc:  # noqa: BLE001
            logger.exception("Doubao plain-text request failed")
            raise DoubaoServiceError(str(exc)) from exc

        response_payload = self._response_to_dict(response)
        text_output = self._extract_plain_text(response_payload)

        return {
            "text": text_output,
            "response": response_payload,
            "format": output_format,
        }

    def _resolve_profile(self, note_type: str) -> PromptProfile:
        return resolve_prompt_profile(note_type)

    def _encode_image(self, path: str, *, detail: Optional[str]) -> Dict[str, Any]:
        file_path = Path(path)
        if not file_path.exists():
            raise DoubaoServiceError(f"Image not found: {path}")

        mime_type, _ = mimetypes.guess_type(str(file_path))
        mime_type = mime_type or IMAGE_MIME_DEFAULT
        with file_path.open("rb") as file_handle:
            data = base64.b64encode(file_handle.read()).decode("utf-8")
        content_url = f"data:{mime_type};base64,{data}"

        detail_value = (detail or settings.DOUBAO_DETAIL or "auto").lower()
        if detail_value not in SUPPORTED_DETAIL_VALUES and detail_value != "auto":
            detail_value = "auto"

        return {
            "type": "image_url",
            "image_url": {
                "url": content_url,
                "detail": detail_value,
            }
        }

    def _response_to_dict(self, response: Any) -> Dict[str, Any]:
        for attr in ("model_dump", "to_dict", "dict"):
            method = getattr(response, attr, None)
            if callable(method):
                try:
                    return method()
                except TypeError:
                    continue
        json_attr = getattr(response, "model_dump_json", None)
        if callable(json_attr):
            return json.loads(json_attr())
        json_method = getattr(response, "json", None)
        if callable(json_method):
            raw = json_method()
            return json.loads(raw) if isinstance(raw, str) else raw
        raise DoubaoServiceError("Unsupported response type from Doubao SDK")

    def _collect_message_texts(self, payload: Dict[str, Any]) -> List[str]:
        # 标准 Chat Completions API 响应格式
        # {"choices": [{"message": {"role": "assistant", "content": "..."}}]}
        message_texts: List[str] = []

        choices = payload.get("choices", [])
        for choice in choices:
            message = choice.get("message", {})
            content = message.get("content")
            if content:
                message_texts.append(content)

        return message_texts

    def _clean_json_string(self, text: str) -> str:
        """Clean JSON string from markdown code blocks and other noise."""
        text = text.strip()
        
        # Strategy 1: Look for ```json ... ``` block specifically
        json_block = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
        if json_block:
            return json_block.group(1).strip()

        # Strategy 2: Look for any code block ``` ... ``` that looks like JSON
        code_block = re.search(r"```\s*(.*?)\s*```", text, re.DOTALL)
        if code_block:
            content = code_block.group(1).strip()
            if content.startswith("{"):
                return content

        # Strategy 3: Find outermost braces
        first_brace = text.find("{")
        last_brace = text.rfind("}")
        if first_brace != -1 and last_brace != -1:
            return text[first_brace : last_brace + 1]
            
        return text

    def _repair_json(self, json_str: str) -> str:
        """Attempt to repair common JSON errors."""
        # 1. Remove trailing commas in objects/arrays
        json_str = re.sub(r",\s*([\]}])", r"\1", json_str)
        
        # 2. Escape invalid backslashes (e.g. \p in \pi, \s in \sin)
        # We want to match backslash that is NOT followed by a valid escape char
        # Valid JSON escapes: " \ / b f n r t u
        # However, in LaTeX context:
        # \b (backspace) -> likely \beta
        # \f (formfeed) -> likely \frac
        # \r (return) -> likely \right
        # \t (tab) -> likely \tan, \theta
        # So we SHOULD escape b, f, r, t to preserve them as literal backslashes for LaTeX.
        # We MUST preserve n (newline) for text formatting.
        # We MUST preserve " \ / for JSON structure.
        
        def replace_escape(match):
            char = match.group(1)
            # Preserve structural escapes and newline
            if char in '"\\/n':
                return match.group(0)
            # Escape everything else (including b, f, r, t, u, and invalid chars like p, s, c)
            return r"\\" + char

        return re.sub(r"\\(.)", replace_escape, json_str)

    def _extract_note_payload(self, payload: Dict[str, Any]) -> tuple[Dict[str, Any], str]:
        message_texts = self._collect_message_texts(payload)

        if not message_texts:
            raise DoubaoServiceError("Doubao response did not contain assistant message text")

        joined = "\n".join(message_texts).strip()
        cleaned_json = self._clean_json_string(joined)
        
        try:
            note_data = json.loads(cleaned_json)
        except json.JSONDecodeError:
            # Try repairing
            repaired_json = self._repair_json(cleaned_json)
            try:
                note_data = json.loads(repaired_json)
            except json.JSONDecodeError as exc:
                logger.error("Failed to decode Doubao JSON output. Raw: %s, Cleaned: %s, Repaired: %s", joined, cleaned_json, repaired_json)
                raise DoubaoServiceError("Doubao response is not valid JSON") from exc

        raw_text = note_data.get("raw_text") or note_data.get("transcript", "")
        return note_data, raw_text

    def _extract_plain_text(self, payload: Dict[str, Any]) -> str:
        message_texts = self._collect_message_texts(payload)
        if not message_texts:
            raise DoubaoServiceError("Doubao response did not contain assistant message text")
        return "\n".join(message_texts).strip()

    def _build_response_format(
        self,
        *,
        model_id: str,
        schema_payload: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        mode = self._resolve_structured_output_mode(model_id)
        if mode == "json_schema":
            return {
                "type": "json_schema",
                "json_schema": {
                    "name": "structured_note",
                    "schema": schema_payload,
                    "strict": True,
                },
            }
        if mode == "json_object":
            return {"type": "json_object"}

        logger.info(
            "Model %s does not support structured_outputs, using prompt-only JSON generation",
            model_id,
        )
        return None

    def _resolve_structured_output_mode(self, model_id: str) -> Optional[str]:
        metadata = self._get_model_metadata(model_id)
        if not metadata:
            # Backward compatibility when /models metadata is temporarily unavailable.
            return "json_schema"

        structured_outputs = (
            metadata.get("features", {})
            .get("structured_outputs", {})
        )
        if structured_outputs.get("json_schema"):
            return "json_schema"
        if structured_outputs.get("json_object"):
            return "json_object"
        return None

    def _get_model_metadata(self, model_id: str) -> Optional[Dict[str, Any]]:
        if not self._model_catalog_loaded:
            self._load_model_catalog()
        return self._model_catalog_cache.get(model_id)

    def _load_model_catalog(self) -> None:
        client = self._ensure_client()
        try:
            payload = client.get("/models", cast_to=object)
            model_list = payload.get("data", []) if isinstance(payload, dict) else []
            for model_item in model_list:
                if not isinstance(model_item, dict):
                    continue
                model_key = model_item.get("id")
                if isinstance(model_key, str) and model_key:
                    self._model_catalog_cache[model_key] = model_item
        except Exception:  # noqa: BLE001
            logger.warning("Failed to load model metadata from /models", exc_info=True)
        finally:
            self._model_catalog_loaded = True

    @staticmethod
    def _is_json_schema_unsupported(exc: Exception) -> bool:
        message = str(exc).lower()
        return (
            "response_format.type" in message
            and "json_schema" in message
            and ("not supported" in message or "invalidparameter" in message or "not valid" in message)
        )


doubao_service = DoubaoVisionService()
