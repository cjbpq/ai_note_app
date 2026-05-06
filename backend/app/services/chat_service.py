from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Any, Dict, Iterable, List, Literal, Optional

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.chat import ChatConversation, ChatMessage, ChatNoteSuggestion
from app.services.doubao_chat_service import DoubaoChatService, doubao_chat_service
from app.services.note_index_service import NoteIndexService, try_index_note
from app.services.note_service import NoteService
from app.services.nexoradb_service import NexoraDBClient, NexoraDBError, NexoraDBHit, nexoradb_client

logger = logging.getLogger(__name__)

ChatIntent = Literal["chat", "note_question", "out_of_scope_note_worthy"]
NOTE_SUGGESTION_TOOL_NAME = "propose_note"
TOKEN_ESTIMATE_CHARS_PER_TOKEN = 2
CONTEXT_SAFETY_MARGIN_TOKENS = 1024
NOTE_WORTHY_MARKERS = (
    "记住",
    "记录一下",
    "帮我记录",
    "保存一下",
    "添加到笔记",
    "加入笔记",
    "存成笔记",
    "补充到笔记",
    "保存到笔记",
    "写进笔记",
    "放到笔记",
    "沉淀到笔记",
    "沉淀为笔记",
    "整理成笔记",
    "生成笔记",
    "转成笔记",
    "做成笔记",
    "变成笔记",
    "形成笔记",
    "沉淀到知识库",
    "沉淀到我的知识库",
    "写入知识库",
    "加入知识库",
    "保存到知识库",
)
NOTE_GENERATION_MARKERS = (
    "帮我做",
    "做一篇",
    "写一篇",
    "生成一条",
    "生成一张",
    "生成一份",
    "生成一篇",
    "帮我整理",
    "整理成",
    "整理为",
    "整理一条",
    "整理一份",
    "整理一篇",
    "沉淀",
    "知识库",
    "保存",
    "记录",
    "tool_calling",
)
SUBJECT_CATEGORY_MARKERS = (
    ("物理", ("物理", "电磁", "力学", "热学", "光学", "量子")),
    ("数学", ("数学", "函数", "极限", "导数", "积分", "线代", "概率", "几何")),
    ("英语", ("英语", "单词", "语法", "阅读", "写作", "听力")),
    ("语文", ("语文", "文言文", "古诗", "作文", "阅读理解")),
    ("化学", ("化学", "反应", "方程式", "有机", "无机")),
    ("生物", ("生物", "细胞", "遗传", "生态", "代谢")),
)


class ChatNotFoundError(LookupError):
    pass


class ChatAccessError(PermissionError):
    pass


@dataclass
class ToolCallResult:
    kind: Literal["suggestion_created", "invalid_args", "error"]
    suggestion: Optional[ChatNoteSuggestion] = None
    message: str = ""

    def as_dict(self) -> Dict[str, Any]:
        if self.kind == "suggestion_created" and self.suggestion is not None:
            return {
                "status": "ok",
                "suggestion_id": str(self.suggestion.id),
                "title": self.suggestion.title,
                "message": "笔记建议已生成，等待用户确认。",
            }
        if self.kind == "invalid_args":
            return {
                "status": "invalid_args",
                "message": self.message or "工具参数不完整或格式错误，请修正后重试。",
            }
        return {
            "status": "error",
            "message": self.message or "工具执行失败，请告知用户稍后重试。",
        }


class ToolCallLoopGuard:
    """Prevents runaway model-tool feedback loops."""

    def __init__(
        self,
        *,
        max_rounds: int = 5,
        max_consecutive_tool_rounds: int = 3,
        repeat_signature_limit: int = 3,
        timeout_seconds: int = 120,
    ) -> None:
        self.max_rounds = max_rounds
        self.max_consecutive_tool_rounds = max_consecutive_tool_rounds
        self.repeat_signature_limit = repeat_signature_limit
        self.timeout_seconds = timeout_seconds
        self.consecutive_tool_only_rounds = 0
        self.last_tool_signature = ""
        self.repeat_count = 0
        self.started_at = time.time()

    def check(self, *, round_num: int, has_text: bool, tool_calls: List[Dict[str, Any]]) -> Optional[str]:
        if round_num >= self.max_rounds:
            return "max_rounds"

        tool_signature = self._signature(tool_calls)
        if not has_text and tool_calls:
            self.consecutive_tool_only_rounds += 1
        else:
            self.consecutive_tool_only_rounds = 0

        if tool_signature and tool_signature == self.last_tool_signature:
            self.repeat_count += 1
        else:
            self.repeat_count = 1 if tool_signature else 0
        self.last_tool_signature = tool_signature

        if self.consecutive_tool_only_rounds >= self.max_consecutive_tool_rounds:
            return "consecutive_tool_only"
        if self.repeat_count >= self.repeat_signature_limit:
            return "repeat_signature"
        if time.time() - self.started_at > self.timeout_seconds:
            return "timeout"
        return None

    @staticmethod
    def _signature(tool_calls: List[Dict[str, Any]]) -> str:
        parts = []
        for tool_call in tool_calls:
            if not isinstance(tool_call, dict):
                continue
            function = tool_call.get("function") or {}
            if not isinstance(function, dict):
                function = {}
            parts.append(
                json.dumps(
                    {
                        "name": function.get("name") or tool_call.get("name") or tool_call.get("tool"),
                        "arguments": function.get("arguments")
                        if "arguments" in function
                        else tool_call.get("arguments") or tool_call.get("parameters"),
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                    default=str,
                )
            )
        return "|".join(parts)


def classify_chat_intent(message: str) -> ChatIntent:
    text = " ".join(str(message or "").strip().split())
    lower = text.lower()
    if not text:
        return "chat"

    if any(marker in text for marker in NOTE_WORTHY_MARKERS):
        return "out_of_scope_note_worthy"
    if "笔记" in text and any(marker in text for marker in NOTE_GENERATION_MARKERS):
        return "out_of_scope_note_worthy"

    question_markers = (
        "?",
        "？",
        "什么",
        "如何",
        "怎么",
        "为什么",
        "是否",
        "解释",
        "讲讲",
        "说说",
        "介绍",
        "总结",
        "归纳",
        "复习",
        "原理",
        "应用场景",
        "局限性",
        "根据",
        "查找",
        "搜索",
        "笔记",
        "我学过",
        "之前",
    )
    if any(marker in text for marker in question_markers):
        return "note_question"

    casual_exact = {
        "hi",
        "hello",
        "hey",
        "你好",
        "您好",
        "谢谢",
        "感谢",
        "你是谁",
        "在吗",
    }
    if lower in casual_exact or text in casual_exact:
        return "chat"

    return "chat"


def should_enable_note_suggestion_tool(
    *,
    intent: ChatIntent,
    references: List[Dict[str, Any]],
    message_length: Optional[int] = None,
) -> bool:
    _ = (references, message_length)
    return intent == "out_of_scope_note_worthy"


class ChatService:
    def __init__(
        self,
        db: Session,
        *,
        vector_client: Optional[NexoraDBClient] = None,
        model_service: Optional[DoubaoChatService] = None,
    ) -> None:
        self.db = db
        self.vector_client = vector_client or nexoradb_client
        self.model_service = model_service or doubao_chat_service

    # ── Conversation persistence ─────────────────────────────────────

    def get_or_create_conversation(
        self,
        *,
        user_id: str,
        conversation_id: Optional[str],
        first_message: str,
    ) -> ChatConversation:
        if conversation_id:
            conversation = self.get_conversation(user_id=user_id, conversation_id=conversation_id)
            if conversation is None:
                raise ChatNotFoundError("conversation not found")
            return conversation

        title = self._generate_title(first_message)
        conversation = ChatConversation(
            user_id=user_id,
            title=title,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)
        return conversation

    def get_conversation(self, *, user_id: str, conversation_id: str) -> Optional[ChatConversation]:
        return (
            self.db.query(ChatConversation)
            .filter(
                ChatConversation.id == str(conversation_id),
                ChatConversation.user_id == user_id,
                ChatConversation.is_deleted.is_(False),
            )
            .first()
        )

    def list_conversations(self, *, user_id: str, skip: int = 0, limit: int = 50) -> tuple[List[ChatConversation], int]:
        query = self.db.query(ChatConversation).filter(
            ChatConversation.user_id == user_id,
            ChatConversation.is_deleted.is_(False),
        )
        total = query.count()
        rows = query.order_by(ChatConversation.updated_at.desc()).offset(skip).limit(limit).all()
        return rows, total

    def search_conversations(self, *, user_id: str, query_text: str, limit: int = 50) -> List[ChatConversation]:
        pattern = f"%{query_text}%"
        rows = (
            self.db.query(ChatConversation)
            .outerjoin(ChatMessage, ChatMessage.conversation_id == ChatConversation.id)
            .filter(
                ChatConversation.user_id == user_id,
                ChatConversation.is_deleted.is_(False),
                or_(ChatConversation.title.ilike(pattern), ChatMessage.content.ilike(pattern)),
            )
            .order_by(ChatConversation.updated_at.desc())
            .distinct()
            .limit(limit)
            .all()
        )
        return rows

    def get_messages(self, *, user_id: str, conversation_id: str) -> List[ChatMessage]:
        conversation = self.get_conversation(user_id=user_id, conversation_id=conversation_id)
        if conversation is None:
            raise ChatNotFoundError("conversation not found")
        return (
            self.db.query(ChatMessage)
            .filter(ChatMessage.conversation_id == str(conversation_id), ChatMessage.user_id == user_id)
            .order_by(ChatMessage.sequence.asc())
            .all()
        )

    def add_message(
        self,
        *,
        user_id: str,
        conversation_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ChatMessage:
        last_error: Optional[IntegrityError] = None
        for _attempt in range(3):
            conversation = (
                self.db.query(ChatConversation)
                .filter(
                    ChatConversation.id == str(conversation_id),
                    ChatConversation.user_id == user_id,
                    ChatConversation.is_deleted.is_(False),
                )
                .first()
            )
            if conversation is None:
                raise ChatNotFoundError("conversation not found")

            max_sequence = (
                self.db.query(func.max(ChatMessage.sequence))
                .filter(ChatMessage.conversation_id == str(conversation_id))
                .scalar()
            )
            message = ChatMessage(
                conversation_id=str(conversation_id),
                user_id=user_id,
                role=role,
                content=content,
                sequence=int(max_sequence or 0) + 1,
                message_metadata=metadata or {},
                created_at=datetime.now(timezone.utc),
            )
            conversation.updated_at = datetime.now(timezone.utc)
            self.db.add(message)
            self.db.add(conversation)
            try:
                self.db.commit()
            except IntegrityError as exc:
                self.db.rollback()
                last_error = exc
                continue
            self.db.refresh(message)
            return message

        if last_error is not None:
            raise last_error
        raise ChatAccessError("failed to persist message")

    def soft_delete_conversation(self, *, user_id: str, conversation_id: str) -> bool:
        conversation = self.get_conversation(user_id=user_id, conversation_id=conversation_id)
        if conversation is None:
            return False
        conversation.is_deleted = True
        conversation.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        return True

    def batch_delete_conversations(self, *, user_id: str, conversation_ids: Iterable[str]) -> Dict[str, Any]:
        deleted_count = 0
        not_found_ids: List[str] = []
        for conversation_id in conversation_ids:
            if self.soft_delete_conversation(user_id=user_id, conversation_id=str(conversation_id)):
                deleted_count += 1
            else:
                not_found_ids.append(str(conversation_id))
        return {"deleted_count": deleted_count, "not_found_ids": not_found_ids}

    def fork_conversation(self, *, user_id: str, conversation_id: str, from_message_id: str) -> ChatConversation:
        source = self.get_conversation(user_id=user_id, conversation_id=conversation_id)
        if source is None:
            raise ChatNotFoundError("conversation not found")
        source_message = (
            self.db.query(ChatMessage)
            .filter(
                ChatMessage.id == str(from_message_id),
                ChatMessage.conversation_id == str(conversation_id),
                ChatMessage.user_id == user_id,
            )
            .first()
        )
        if source_message is None:
            raise ChatNotFoundError("message not found")

        fork = ChatConversation(
            user_id=user_id,
            title=f"{source.title} 分支"[:255],
            parent_conversation_id=source.id,
            forked_from_message_id=source_message.id,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self.db.add(fork)
        self.db.flush()

        forked_at = datetime.now(timezone.utc)
        messages = (
            self.db.query(ChatMessage)
            .filter(
                ChatMessage.conversation_id == source.id,
                ChatMessage.user_id == user_id,
                ChatMessage.sequence <= source_message.sequence,
            )
            .order_by(ChatMessage.sequence.asc())
            .all()
        )
        for idx, message in enumerate(messages, start=1):
            self.db.add(
                ChatMessage(
                    conversation_id=fork.id,
                    user_id=user_id,
                    role=message.role,
                    content=message.content,
                    sequence=idx,
                    message_metadata=json.loads(json.dumps(message.message_metadata or {})),
                    created_at=forked_at,
                )
            )
        self.db.commit()
        self.db.refresh(fork)
        return fork

    # ── RAG retrieval ────────────────────────────────────────────────

    def retrieve_references(
        self,
        *,
        user_id: str,
        message: str,
        referenced_note_ids: Iterable[str],
        top_k: Optional[int] = None,
        query_vector: bool = True,
    ) -> List[Dict[str, Any]]:
        explicit_references = self._dedupe_references(
            self._references_from_explicit_notes(user_id=user_id, note_ids=list(referenced_note_ids))
        )

        if not query_vector:
            return self._strip_internal_reference_flags(explicit_references)

        configured_top_k = int(top_k or settings.CHAT_RAG_TOP_K)
        if not self.vector_client.is_configured:
            raise NexoraDBError("NexoraDB service is not configured")
        hits = self.vector_client.query_text(
            user_id=user_id,
            text=message,
            top_k=configured_top_k,
            library="notes",
        )
        explicit_chunk_keys = {(ref.get("note_id"), ref.get("chunk_id")) for ref in explicit_references}
        vector_references = self._dedupe_and_cap_references(
            self._references_from_hits(user_id=user_id, hits=hits),
            skip_chunk_keys=explicit_chunk_keys,
        )
        return self._strip_internal_reference_flags([*explicit_references, *vector_references])

    def build_model_messages(
        self,
        *,
        user_id: str,
        conversation_id: str,
        intent: ChatIntent,
        references: List[Dict[str, Any]],
        note_tool_enabled: bool = False,
        force_compact: bool = False,
        force_reference_summary: bool = False,
    ) -> List[Dict[str, str]]:
        conversation = self.get_conversation(user_id=user_id, conversation_id=conversation_id)
        if conversation is None:
            raise ChatNotFoundError("conversation not found")

        compacted_for_request = False
        if force_compact:
            self.compact_conversation(user_id=user_id, conversation_id=conversation_id, force=True)
            self.db.refresh(conversation)
            compacted_for_request = True

        model_references = references
        reference_summary: Optional[str] = None
        messages = self._assemble_model_messages(
            conversation=conversation,
            user_id=user_id,
            intent=intent,
            references=model_references,
            reference_summary=reference_summary,
            note_tool_enabled=note_tool_enabled,
        )
        if force_reference_summary or self._estimate_messages_tokens(messages) > self._max_input_tokens():
            compacted = False
            if not compacted_for_request:
                compacted = self.compact_conversation(user_id=user_id, conversation_id=conversation_id, force=True)
            if compacted:
                self.db.refresh(conversation)
                messages = self._assemble_model_messages(
                    conversation=conversation,
                    user_id=user_id,
                    intent=intent,
                    references=model_references,
                    reference_summary=reference_summary,
                    note_tool_enabled=note_tool_enabled,
                )

        if (force_reference_summary or self._estimate_messages_tokens(messages) > self._max_input_tokens()) and references:
            reference_summary = self._summarize_references_for_context(references)
            messages = self._assemble_model_messages(
                conversation=conversation,
                user_id=user_id,
                intent=intent,
                references=[],
                reference_summary=reference_summary,
                note_tool_enabled=note_tool_enabled,
            )

        if self._estimate_messages_tokens(messages) > self._max_input_tokens():
            messages = self._fit_messages_to_context(messages)
        return messages

    def compact_conversation(self, *, user_id: str, conversation_id: str, force: bool = False) -> bool:
        conversation = self.get_conversation(user_id=user_id, conversation_id=conversation_id)
        if conversation is None:
            raise ChatNotFoundError("conversation not found")

        keep_recent = max(1, int(settings.CHAT_COMPACT_KEEP_RECENT_MESSAGES or 12))
        history = (
            self.db.query(ChatMessage)
            .filter(ChatMessage.conversation_id == str(conversation_id), ChatMessage.user_id == user_id)
            .order_by(ChatMessage.sequence.asc())
            .all()
        )
        eligible = [message for message in history if message.role in {"user", "assistant"}]
        if len(eligible) <= keep_recent:
            return False

        cutoff_sequence = eligible[-keep_recent - 1].sequence
        compacted_until = int(conversation.context_compacted_until_sequence or 0)
        if cutoff_sequence <= compacted_until and not force:
            return False

        messages_to_compact = [
            message
            for message in eligible
            if compacted_until < int(message.sequence) <= cutoff_sequence
        ]
        if not messages_to_compact:
            return False

        new_summary = self._generate_context_summary(
            existing_summary=conversation.context_summary or "",
            messages=messages_to_compact,
        )
        conversation.context_summary = new_summary
        conversation.context_compacted_until_sequence = cutoff_sequence
        conversation.context_summary_updated_at = datetime.now(timezone.utc)
        conversation.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        return True

    # ── Suggestions ─────────────────────────────────────────────────

    @staticmethod
    def build_note_suggestion_tools() -> List[Dict[str, Any]]:
        return [
            {
                "type": "function",
                "function": {
                    "name": NOTE_SUGGESTION_TOOL_NAME,
                    "description": (
                        "当本轮对话中出现了明确、可独立保存的学习内容（概念、方法、结论、复习材料）时，"
                        "调用此工具创建一条待用户确认的笔记建议。调用后你会收到建议ID确认。"
                        "普通寒暄、内容不足、用户只是提问但未形成可保存内容时不要调用。"
                        "先完成对用户的文字回答，再调用此工具。"
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "笔记标题，6-24个中文字",
                            },
                            "content": {
                                "type": "string",
                                "description": "笔记正文，Markdown格式，需可脱离对话独立理解",
                            },
                            "category": {
                                "type": "string",
                                "description": "笔记分类，如：数学、物理、英语、化学、生物、语文、学习笔记",
                            },
                            "reason": {
                                "type": "string",
                                "description": "为什么值得保存，不填则写'null'",
                            },
                            "tags": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "标签列表，每个标签2-6个字",
                            },
                        },
                        "required": ["title", "content", "tags"],
                    },
                },
            }
        ]

    def create_note_suggestion(
        self,
        *,
        user_id: str,
        conversation_id: str,
        message_id: Optional[str],
        source_message: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
        category: Optional[str] = None,
        tags: Optional[Iterable[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ChatNoteSuggestion:
        suggestion_content = self._clean_note_content(content if content is not None else source_message)
        fallback_text = self._clean_note_content(source_message)
        if not suggestion_content:
            suggestion_content = fallback_text
        suggestion_title = self._clean_inline_text(title)[:255] or self._suggestion_title(
            suggestion_content or fallback_text
        )
        suggestion_metadata = {"source": "propose_note"}
        if metadata:
            suggestion_metadata.update(metadata)
        normalized_tags = self._normalize_tags(tags) or ["chat"]
        suggestion = ChatNoteSuggestion(
            user_id=user_id,
            conversation_id=str(conversation_id),
            message_id=str(message_id) if message_id else None,
            title=suggestion_title,
            content=suggestion_content,
            category=self._infer_note_category(category=category, tags=normalized_tags, content=suggestion_content),
            tags=normalized_tags,
            status="pending",
            suggestion_metadata=suggestion_metadata,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self.db.add(suggestion)
        self.db.commit()
        self.db.refresh(suggestion)
        return suggestion

    @classmethod
    def _validate_note_suggestion_payload(
        cls,
        *,
        title: str,
        content: str,
        raw_tags: Any,
        normalized_tags: List[str],
        source_message: str,
    ) -> Optional[str]:
        if not title:
            return "笔记标题为空。"
        if len(cls._clean_inline_text(content)) < 8:
            return "笔记内容过短。"
        if raw_tags is not None and not isinstance(raw_tags, list):
            return "标签必须是数组。"
        if isinstance(raw_tags, list) and raw_tags and not normalized_tags:
            return "标签内容无效。"
        if cls._is_low_value_repetition(content=content, source_message=source_message):
            return "笔记内容与用户输入高度重复，缺少可保存的整理信息。"
        return None

    @classmethod
    def _is_low_value_repetition(cls, *, content: str, source_message: str) -> bool:
        content_key = cls._similarity_key(content)
        source_key = cls._similarity_key(source_message)
        if len(content_key) < 12 or len(source_key) < 12:
            return False

        has_structure = bool(
            re.search(r"(^|\n)\s*(?:#{1,6}\s+|[-*]\s+|\d+[.)、]\s+)", content)
            or "\n" in content.strip()
        )
        if has_structure:
            return False

        ratio = SequenceMatcher(None, content_key, source_key).ratio()
        return ratio >= 0.92 and len(content_key) <= int(len(source_key) * 1.2)

    @staticmethod
    def _similarity_key(text: str) -> str:
        value = str(text or "").lower()
        return re.sub(r"[\s:：,，.。!！?？;；、()（）\[\]【】{}《》<>\"'`*_#\-]+", "", value)

    def execute_note_suggestion_tool(
        self,
        *,
        user_id: str,
        conversation_id: str,
        tool_call: Dict[str, Any],
        source_message: str,
    ) -> ToolCallResult:
        if self._tool_call_name(tool_call) != NOTE_SUGGESTION_TOOL_NAME:
            return ToolCallResult(kind="invalid_args", message="未知工具调用。")

        args = self._parse_tool_call_arguments(tool_call)
        if args is None:
            return ToolCallResult(kind="invalid_args")

        content = self._clean_note_content(args.get("content"))
        title = self._clean_inline_text(args.get("title"))[:255]
        category = self._clean_inline_text(args.get("category")) or None
        raw_tags = args.get("tags")
        tags = self._normalize_tags(raw_tags if isinstance(raw_tags, list) else [])
        reason = self._clean_inline_text(args.get("reason")) or None
        validation_error = self._validate_note_suggestion_payload(
            title=title,
            content=content,
            raw_tags=raw_tags,
            normalized_tags=tags,
            source_message=source_message,
        )
        if validation_error:
            return ToolCallResult(kind="invalid_args", message=validation_error)

        tool_call_id = self._clean_inline_text(tool_call.get("id"))
        if tool_call_id:
            for existing in self.get_suggestions_by_tool_call_ids(
                user_id=user_id,
                conversation_id=conversation_id,
                tool_call_ids=[tool_call_id],
            ):
                if str(existing.conversation_id) == str(conversation_id):
                    return ToolCallResult(kind="suggestion_created", suggestion=existing)

        try:
            suggestion = self.create_note_suggestion(
                user_id=user_id,
                conversation_id=conversation_id,
                message_id=None,
                source_message=source_message,
                title=title,
                content=content,
                category=category,
                tags=tags,
                metadata={
                    "source": "propose_note_tool_call",
                    "tool_call_id": tool_call.get("id"),
                    "tool_call_index": tool_call.get("index"),
                    "reason": reason,
                },
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to execute propose_note tool")
            return ToolCallResult(kind="error", message=str(exc))

        return ToolCallResult(kind="suggestion_created", suggestion=suggestion)

    def create_note_suggestion_from_tool_calls(
        self,
        *,
        user_id: str,
        conversation_id: str,
        message_id: Optional[str],
        tool_calls: Iterable[Dict[str, Any]],
        source_message: str,
    ) -> Optional[ChatNoteSuggestion]:
        parsed = self.parse_note_suggestion_tool_calls(tool_calls)
        if parsed:
            payload, tool_call = parsed
            return self.create_note_suggestion_from_parsed_tool_call(
                user_id=user_id,
                conversation_id=conversation_id,
                message_id=message_id,
                source_message=source_message,
                payload=payload,
                tool_call=tool_call,
            )
        return None

    def parse_note_suggestion_tool_calls(
        self,
        tool_calls: Iterable[Dict[str, Any]],
    ) -> Optional[tuple[Dict[str, Any], Dict[str, Any]]]:
        for tool_call in tool_calls:
            if not isinstance(tool_call, dict):
                continue
            payload = self._parse_note_suggestion_tool_call(tool_call)
            if payload:
                return payload, tool_call
        return None

    def create_note_suggestion_from_parsed_tool_call(
        self,
        *,
        user_id: str,
        conversation_id: str,
        message_id: Optional[str],
        source_message: str,
        payload: Dict[str, Any],
        tool_call: Dict[str, Any],
    ) -> ChatNoteSuggestion:
        return self.create_note_suggestion(
            user_id=user_id,
            conversation_id=conversation_id,
            message_id=message_id,
            source_message=source_message,
            title=payload.get("title"),
            content=payload.get("content"),
            category=payload.get("category"),
            tags=payload.get("tags"),
            metadata={
                "source": "propose_note_tool_call",
                "tool_call_id": tool_call.get("id"),
                "tool_call_index": tool_call.get("index"),
                "reason": payload.get("reason"),
            },
        )

    def get_suggestions_by_message_ids(
        self,
        *,
        user_id: str,
        message_ids: Iterable[str],
    ) -> Dict[str, List[ChatNoteSuggestion]]:
        normalized_ids = [str(message_id) for message_id in message_ids if message_id]
        if not normalized_ids:
            return {}

        rows = (
            self.db.query(ChatNoteSuggestion)
            .filter(
                ChatNoteSuggestion.user_id == user_id,
                ChatNoteSuggestion.message_id.in_(normalized_ids),
            )
            .order_by(ChatNoteSuggestion.created_at.asc())
            .all()
        )
        grouped: Dict[str, List[ChatNoteSuggestion]] = {}
        for suggestion in rows:
            if not suggestion.message_id:
                continue
            grouped.setdefault(str(suggestion.message_id), []).append(suggestion)
        return grouped

    def get_suggestions_by_tool_call_ids(
        self,
        *,
        user_id: str,
        conversation_id: Optional[str] = None,
        tool_call_ids: Iterable[str],
    ) -> List[ChatNoteSuggestion]:
        wanted = [str(item) for item in tool_call_ids if item]
        if not wanted:
            return []
        wanted_set = set(wanted)
        query = self.db.query(ChatNoteSuggestion).filter(ChatNoteSuggestion.user_id == user_id)
        if conversation_id:
            query = query.filter(ChatNoteSuggestion.conversation_id == str(conversation_id))

        tool_call_id_expr = ChatNoteSuggestion.suggestion_metadata["tool_call_id"].as_string()
        rows = query.filter(tool_call_id_expr.in_(wanted)).order_by(ChatNoteSuggestion.created_at.asc()).all()
        by_id: Dict[str, ChatNoteSuggestion] = {}
        for suggestion in rows:
            metadata = suggestion.suggestion_metadata or {}
            if not isinstance(metadata, dict):
                continue
            tool_call_id = str(metadata.get("tool_call_id") or "")
            if tool_call_id in wanted_set and tool_call_id not in by_id:
                by_id[tool_call_id] = suggestion
        ordered: List[ChatNoteSuggestion] = []
        seen: set[str] = set()
        for item in wanted:
            if item in by_id and item not in seen:
                ordered.append(by_id[item])
                seen.add(item)
        return ordered

    def ensure_suggestions_for_messages(
        self,
        *,
        user_id: str,
        conversation_id: str,
        messages: Iterable[ChatMessage],
    ) -> Dict[str, List[ChatNoteSuggestion]]:
        materialized_messages = list(messages)
        suggestions_by_message_id = self.get_suggestions_by_message_ids(
            user_id=user_id,
            message_ids=[str(message.id) for message in materialized_messages],
        )
        needs_commit = False

        for message in materialized_messages:
            message_id = str(message.id)
            if message.role != "assistant":
                continue

            metadata = message.message_metadata or {}
            if not isinstance(metadata, dict):
                continue
            raw_tool_calls = metadata.get("tool_calls")
            if isinstance(raw_tool_calls, dict):
                tool_calls = [raw_tool_calls]
            elif isinstance(raw_tool_calls, list):
                tool_calls = [tool_call for tool_call in raw_tool_calls if isinstance(tool_call, dict)]
            else:
                continue

            if not tool_calls:
                continue

            seen_suggestion_ids = {str(suggestion.id) for suggestion in suggestions_by_message_id.get(message_id, [])}
            existing_suggestions = self.get_suggestions_by_tool_call_ids(
                user_id=user_id,
                conversation_id=conversation_id,
                tool_call_ids=[
                    self._clean_inline_text((tool_call.get("id") if isinstance(tool_call, dict) else None))
                    for tool_call in tool_calls
                    if self._clean_inline_text((tool_call.get("id") if isinstance(tool_call, dict) else None))
                ],
            )
            existing_by_tool_call_id: Dict[str, ChatNoteSuggestion] = {}
            for suggestion in existing_suggestions:
                metadata = suggestion.suggestion_metadata or {}
                if not isinstance(metadata, dict):
                    continue
                tool_call_id = self._clean_inline_text(metadata.get("tool_call_id"))
                if tool_call_id and tool_call_id not in existing_by_tool_call_id:
                    existing_by_tool_call_id[tool_call_id] = suggestion

            for tool_call in tool_calls:
                tool_call_id = self._clean_inline_text(tool_call.get("id"))
                if tool_call_id and tool_call_id in existing_by_tool_call_id:
                    suggestion = existing_by_tool_call_id[tool_call_id]
                    if not suggestion.message_id:
                        suggestion.message_id = message_id
                        needs_commit = True
                    if str(suggestion.id) not in seen_suggestion_ids:
                        suggestions_by_message_id.setdefault(message_id, []).append(suggestion)
                        seen_suggestion_ids.add(str(suggestion.id))
                    continue

                payload = self._parse_note_suggestion_tool_call(tool_call)
                if not payload:
                    continue

                suggestion = self.create_note_suggestion_from_parsed_tool_call(
                    user_id=user_id,
                    conversation_id=conversation_id,
                    message_id=message_id,
                    source_message=message.content,
                    payload=payload,
                    tool_call=tool_call,
                )
                if str(suggestion.id) not in seen_suggestion_ids:
                    suggestions_by_message_id.setdefault(message_id, []).append(suggestion)
                    seen_suggestion_ids.add(str(suggestion.id))

        if needs_commit:
            self.db.commit()

        return suggestions_by_message_id

    def get_suggestion(self, *, user_id: str, suggestion_id: str) -> Optional[ChatNoteSuggestion]:
        return (
            self.db.query(ChatNoteSuggestion)
            .filter(ChatNoteSuggestion.id == str(suggestion_id), ChatNoteSuggestion.user_id == user_id)
            .first()
        )

    def accept_suggestion(
        self,
        *,
        user_id: str,
        suggestion_id: str,
        category: Optional[str] = None,
    ) -> ChatNoteSuggestion:
        suggestion = self.get_suggestion(user_id=user_id, suggestion_id=suggestion_id)
        if suggestion is None:
            raise ChatNotFoundError("suggestion not found")
        if suggestion.status == "accepted" and suggestion.note_id:
            return suggestion
        if suggestion.status != "pending":
            raise ChatAccessError("suggestion is not pending")

        selected_category = self._clean_inline_text(category)
        if selected_category:
            suggestion.category = selected_category[:100]
            suggestion.updated_at = datetime.now(timezone.utc)

        note_payload = self.build_note_payload_from_suggestion(suggestion)
        note = NoteService(self.db).create_note(
            note_payload,
            user_id,
            device_id=user_id,
            commit=False,
            index=False,
        )
        suggestion.status = "accepted"
        suggestion.note_id = str(note.id)
        suggestion.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(suggestion)
        try_index_note(self.db, note)
        return suggestion

    def build_note_payload_from_suggestion(self, suggestion: ChatNoteSuggestion) -> Dict[str, Any]:
        content = self._clean_note_content(suggestion.content)
        tags = self._normalize_tags(suggestion.tags or []) or ["chat"]
        category = self._infer_note_category(category=suggestion.category, tags=tags, content=content)
        structured_data = self._build_structured_note_data(
            title=suggestion.title,
            content=content,
            category=category,
            tags=tags,
            metadata=suggestion.suggestion_metadata or {},
            suggestion_id=suggestion.id,
        )
        return {
            "title": suggestion.title,
            "category": category,
            "tags": tags,
            "image_urls": [],
            "image_filenames": [],
            "image_sizes": [],
            "original_text": content,
            "structured_data": structured_data,
        }

    def dismiss_suggestion(self, *, user_id: str, suggestion_id: str) -> ChatNoteSuggestion:
        suggestion = self.get_suggestion(user_id=user_id, suggestion_id=suggestion_id)
        if suggestion is None:
            raise ChatNotFoundError("suggestion not found")
        if suggestion.status == "pending":
            suggestion.status = "dismissed"
            suggestion.updated_at = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(suggestion)
        return suggestion

    # ── Serialization ───────────────────────────────────────────────

    @staticmethod
    def serialize_conversation(conversation: ChatConversation) -> Dict[str, Any]:
        return {
            "id": conversation.id,
            "title": conversation.title,
            "parent_conversation_id": conversation.parent_conversation_id,
            "forked_from_message_id": conversation.forked_from_message_id,
            "created_at": conversation.created_at,
            "updated_at": conversation.updated_at,
        }

    @staticmethod
    def serialize_message(
        message: ChatMessage,
        suggestions: Optional[Iterable[ChatNoteSuggestion]] = None,
    ) -> Dict[str, Any]:
        return {
            "id": message.id,
            "conversation_id": message.conversation_id,
            "role": message.role,
            "content": message.content,
            "sequence": message.sequence,
            "metadata": message.message_metadata or {},
            "suggestions": [
                ChatService.serialize_suggestion(suggestion)
                for suggestion in suggestions or []
            ],
            "created_at": message.created_at,
        }

    @staticmethod
    def serialize_suggestion(suggestion: ChatNoteSuggestion) -> Dict[str, Any]:
        return {
            "id": suggestion.id,
            "conversation_id": suggestion.conversation_id,
            "message_id": suggestion.message_id,
            "title": suggestion.title,
            "content": suggestion.content,
            "category": suggestion.category,
            "tags": suggestion.tags or [],
            "status": suggestion.status,
            "note_id": suggestion.note_id,
            "metadata": suggestion.suggestion_metadata or {},
            "created_at": suggestion.created_at,
            "updated_at": suggestion.updated_at,
        }

    # ── Internal helpers ────────────────────────────────────────────

    def _generate_title(self, first_message: str) -> str:
        try:
            return self.model_service.generate_title(first_message)
        except Exception:  # noqa: BLE001
            clean = " ".join(str(first_message or "").split())
            return clean[:48] or "新对话"

    def _references_from_explicit_notes(self, *, user_id: str, note_ids: List[str]) -> List[Dict[str, Any]]:
        if not note_ids:
            return []
        requested = [str(item) for item in note_ids]
        notes = NoteService(self.db).get_notes_by_ids(user_id, requested)
        found_by_id = {str(note.id): note for note in notes}
        missing = [note_id for note_id in requested if note_id not in found_by_id]
        if missing:
            raise ChatAccessError("referenced note not found or inaccessible")

        references: List[Dict[str, Any]] = []
        indexer = NoteIndexService(self.db, vector_client=self.vector_client)
        for note_id in requested:
            note = found_by_id[note_id]
            chunks = indexer.extract_chunks(note)
            for chunk in chunks:
                references.append(
                    {
                        "note_id": str(note.id),
                        "title": note.title,
                        "chunk_id": chunk.chunk_id,
                        "section_heading": chunk.section_heading,
                        "snippet": self._snippet(chunk.text),
                        "score": 1.0,
                        "text": chunk.text,
                        "_explicit": True,
                    }
                )
        return references

    def _references_from_hits(self, *, user_id: str, hits: Iterable[NexoraDBHit]) -> List[Dict[str, Any]]:
        materialized = list(hits)
        note_ids = [
            str(hit.metadata.get("note_id") or "").strip()
            for hit in materialized
            if str(hit.metadata.get("note_id") or "").strip()
        ]
        if not note_ids:
            return []
        notes = NoteService(self.db).get_notes_by_ids(user_id, note_ids)
        notes_by_id = {str(note.id): note for note in notes}

        references: List[Dict[str, Any]] = []
        for hit in materialized:
            note_id = str(hit.metadata.get("note_id") or "").strip()
            note = notes_by_id.get(note_id)
            if note is None:
                continue
            references.append(
                {
                    "note_id": note_id,
                    "title": note.title,
                    "chunk_id": str(hit.metadata.get("chunk_id") or hit.vector_id or ""),
                    "section_heading": str(hit.metadata.get("section_heading") or "") or None,
                    "snippet": self._snippet(hit.text),
                    "score": hit.score,
                    "text": hit.text,
                    "_explicit": False,
                }
            )
        return references

    def _dedupe_and_cap_references(
        self,
        references: List[Dict[str, Any]],
        *,
        skip_chunk_keys: Optional[set] = None,
    ) -> List[Dict[str, Any]]:
        max_chunks = max(1, int(settings.CHAT_RAG_MAX_CHUNKS or 6))
        max_notes = max(1, int(settings.CHAT_RAG_MAX_NOTES or 4))
        max_context_chars = max(1000, int(settings.CHAT_RAG_MAX_CONTEXT_CHARS or 12000))
        seen_chunks = set(skip_chunk_keys or set())
        seen_notes = set()
        out: List[Dict[str, Any]] = []
        total_chars = 0

        ordered = sorted(references, key=lambda item: (not bool(item.get("_explicit")), -(item.get("score") or 0)))
        for ref in ordered:
            chunk_key = (ref.get("note_id"), ref.get("chunk_id"))
            if chunk_key in seen_chunks:
                continue
            if ref.get("note_id") not in seen_notes and len(seen_notes) >= max_notes:
                continue
            text = str(ref.get("text") or "")
            remaining = max_context_chars - total_chars
            if remaining <= 0:
                break
            if len(text) > remaining:
                text = text[:remaining]
                ref = dict(ref)
                ref["text"] = text
                ref["snippet"] = self._snippet(text)
            total_chars += len(text)
            seen_chunks.add(chunk_key)
            seen_notes.add(ref.get("note_id"))
            out.append(ref)
            if len(out) >= max_chunks:
                break

        for ref in out:
            ref.pop("_explicit", None)
        return out

    @staticmethod
    def _dedupe_references(references: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        seen_chunks = set()
        out: List[Dict[str, Any]] = []
        for ref in references:
            chunk_key = (ref.get("note_id"), ref.get("chunk_id"))
            if chunk_key in seen_chunks:
                continue
            seen_chunks.add(chunk_key)
            out.append(ref)
        return out

    @staticmethod
    def _strip_internal_reference_flags(references: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for ref in references:
            item = dict(ref)
            item.pop("_explicit", None)
            out.append(item)
        return out

    def _assemble_model_messages(
        self,
        *,
        conversation: ChatConversation,
        user_id: str,
        intent: ChatIntent,
        references: List[Dict[str, Any]],
        reference_summary: Optional[str],
        note_tool_enabled: bool,
    ) -> List[Dict[str, str]]:
        system_prompt = self._build_context_system_prompt(
            intent=intent,
            has_references=bool(references or reference_summary),
            note_tool_enabled=note_tool_enabled,
        )
        messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
        if references:
            messages.append({"role": "system", "content": self._build_references_prompt(references)})
        elif reference_summary:
            messages.append({"role": "system", "content": f"当前引用资料摘要:\n{reference_summary}"})

        if conversation.context_summary:
            messages.append(
                {
                    "role": "system",
                    "content": f"此前对话摘要:\n{conversation.context_summary}",
                }
            )

        compacted_until = int(conversation.context_compacted_until_sequence or 0)
        history = (
            self.db.query(ChatMessage)
            .filter(
                ChatMessage.conversation_id == str(conversation.id),
                ChatMessage.user_id == user_id,
                ChatMessage.sequence > compacted_until,
            )
            .order_by(ChatMessage.sequence.asc())
            .all()
        )
        for message in history:
            if message.role not in {"user", "assistant"}:
                continue
            messages.append({"role": message.role, "content": message.content})
        return messages

    @staticmethod
    def _build_context_system_prompt(
        *,
        intent: ChatIntent,
        has_references: bool,
        note_tool_enabled: bool,
    ) -> str:
        base = (
            "你是 AI Note 的笔记对话助手。请使用简体中文，回答要清晰、准确、可执行。"
            "如果提供了笔记资料，优先基于资料回答；资料不足时明确说明不确定，不要编造笔记中不存在的内容。"
        )
        if note_tool_enabled:
            base += (
                "如果可用工具包含 propose_note，只在本轮用户输入或你的回答形成明确、可独立保存的学习笔记内容时调用；"
                "普通寒暄、泛泛问答、内容不足或用户不想保存时不要调用。"
            )
        if has_references:
            return base + "当前对话已提供笔记资料，请优先根据资料回答；资料不足时再说明不确定。"
        if intent == "chat":
            return base + "当前没有外部笔记资料，直接回答用户。"
        return base + "当前没有可用的笔记检索结果。"

    def _generate_context_summary(self, *, existing_summary: str, messages: List[ChatMessage]) -> str:
        lines = []
        for message in messages:
            role = "用户" if message.role == "user" else "助手"
            lines.append(f"{role}#{message.sequence}: {message.content}")
        source = "\n\n".join(lines)
        prompt = [
            {
                "role": "system",
                "content": (
                    "你负责为 AI Note 聊天保留滚动上下文摘要。"
                    "请用简体中文压缩旧对话，保留用户目标、已给出的结论、关键约束、待办和重要事实。"
                    "不要加入新信息。"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"已有摘要:\n{existing_summary or '无'}\n\n"
                    f"需要合并的旧消息:\n{source}\n\n"
                    "请输出更新后的摘要。"
                ),
            },
        ]
        try:
            summary = self.model_service.complete_chat(prompt, max_tokens=2048)
        except Exception:  # noqa: BLE001
            fallback = f"{existing_summary}\n\n{source}".strip()
            return fallback[:12000]
        return (summary.strip() or existing_summary or source[:12000])[:12000]

    def _summarize_references_for_context(self, references: List[Dict[str, Any]]) -> str:
        blocks = []
        for idx, ref in enumerate(references, start=1):
            heading = f" / {ref.get('section_heading')}" if ref.get("section_heading") else ""
            blocks.append(
                f"[{idx}] note_id={ref.get('note_id')} title={ref.get('title')}{heading}\n{ref.get('text')}"
            )
        source = "\n\n".join(blocks)
        prompt = [
            {
                "role": "system",
                "content": (
                    "你负责压缩当前轮引用的学习笔记资料。"
                    "请保留每篇笔记的主题、关键概念、步骤、公式、结论和可回答用户问题的证据。"
                    "不要加入资料中没有的信息。"
                ),
            },
            {
                "role": "user",
                "content": f"请把以下引用资料压缩为可供回答问题使用的摘要:\n\n{source}",
            },
        ]
        try:
            summary = self.model_service.complete_chat(prompt, max_tokens=4096)
        except Exception:  # noqa: BLE001
            return source[:48000]
        return summary.strip() or source[:48000]

    @staticmethod
    def _build_references_prompt(references: List[Dict[str, Any]]) -> str:
        blocks = []
        for idx, ref in enumerate(references, start=1):
            heading = f" / {ref.get('section_heading')}" if ref.get("section_heading") else ""
            blocks.append(
                f"[{idx}] note_id={ref.get('note_id')} 标题={ref.get('title')}{heading}\n{ref.get('text')}"
            )
        return "可用笔记资料:\n" + "\n\n".join(blocks)

    def _estimate_messages_tokens(self, messages: List[Dict[str, str]]) -> int:
        chars = 0
        for message in messages:
            chars += len(str(message.get("role") or "")) + len(str(message.get("content") or ""))
        return max(1, chars // TOKEN_ESTIMATE_CHARS_PER_TOKEN)

    @staticmethod
    def _max_input_tokens() -> int:
        window = max(1000, int(settings.DOUBAO_CONTEXT_WINDOW_TOKENS or 256000))
        completion_reserve = max(0, int(settings.DOUBAO_MAX_COMPLETION_TOKENS or 0))
        return max(1000, window - completion_reserve - CONTEXT_SAFETY_MARGIN_TOKENS)

    def _fit_messages_to_context(self, messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
        budget = self._max_input_tokens()
        if self._estimate_messages_tokens(messages) <= budget:
            return messages

        system_messages = [message for message in messages if message.get("role") == "system"]
        conversation_messages = [message for message in messages if message.get("role") != "system"]
        kept = list(conversation_messages)
        while kept and self._estimate_messages_tokens([*system_messages, *kept]) > budget:
            kept.pop(0)
        return [*system_messages, *kept]

    @staticmethod
    def _snippet(text: str, limit: int = 240) -> str:
        clean = ChatService._clean_inline_text(text)
        return clean[:limit]

    @staticmethod
    def _suggestion_title(text: str) -> str:
        clean = ChatService._clean_inline_text(text)
        return (clean[:48] or "聊天补充")

    @staticmethod
    def _infer_note_category(
        *,
        category: Optional[str],
        tags: Optional[Iterable[str]],
        content: str,
    ) -> str:
        explicit = ChatService._clean_inline_text(category)
        if explicit and explicit not in {"聊天补充", "chat", "Chat"}:
            return explicit[:100]

        search_space = " ".join([*(str(tag or "") for tag in tags or []), content[:500]])
        for subject, markers in SUBJECT_CATEGORY_MARKERS:
            if any(marker in search_space for marker in markers):
                return subject
        return "学习笔记"

    @staticmethod
    def _build_structured_note_data(
        *,
        title: str,
        content: str,
        category: str,
        tags: List[str],
        metadata: Dict[str, Any],
        suggestion_id: str,
    ) -> Dict[str, Any]:
        sections = ChatService._extract_note_sections(content)
        key_points = ChatService._extract_key_points(content)
        summary = ChatService._note_summary(content)
        reason = metadata.get("reason") if isinstance(metadata, dict) else None
        study_advice = (
            ChatService._clean_inline_text(reason)
            if reason
            else "复习时先把各章节的核心结论对照理解，再用关键点自测能否独立复述。"
        )
        return {
            "title": title,
            "summary": summary,
            "raw_text": content,
            "sections": sections,
            "key_points": key_points,
            "study_advice": study_advice,
            "meta": {
                "source": "chat_suggestion",
                "provider": "chat",
                "suggestion_id": suggestion_id,
                "category": category,
                "tags": tags,
            },
        }

    @staticmethod
    def _extract_note_sections(content: str) -> List[Dict[str, str]]:
        lines = content.splitlines()
        sections: List[Dict[str, str]] = []
        current_heading: Optional[str] = None
        current_lines: List[str] = []
        saw_heading = False

        def flush() -> None:
            nonlocal current_heading, current_lines
            section_content = "\n".join(line.rstrip() for line in current_lines).strip()
            if section_content:
                sections.append({"heading": current_heading or "概览", "content": section_content})
            current_heading = None
            current_lines = []

        for raw_line in lines:
            line = raw_line.rstrip()
            stripped = line.strip()
            markdown_heading = re.match(r"^#{1,6}\s+(.+)$", stripped)
            numbered_heading = re.match(r"^(?:\d+[.、]|[一二三四五六七八九十]+、)\s*(.+)$", stripped)
            if markdown_heading or numbered_heading:
                heading = (markdown_heading or numbered_heading).group(1).strip()
                if heading:
                    flush()
                    current_heading = heading[:80]
                    saw_heading = True
                    continue
            current_lines.append(line)

        flush()
        if not saw_heading:
            return [{"heading": "知识整理", "content": content}]
        if sections:
            return sections
        return [{"heading": "知识整理", "content": content}]

    @staticmethod
    def _extract_key_points(content: str, limit: int = 7) -> List[str]:
        points: List[str] = []
        for line in content.splitlines():
            stripped = line.strip()
            bullet = re.match(r"^(?:[-*•]\s+|\d+[.)、]\s+)(.+)$", stripped)
            value = bullet.group(1).strip() if bullet else ""
            if not value and any(marker in stripped for marker in ("核心", "总性质", "结论", "定理")):
                value = stripped
            value = ChatService._clean_inline_text(value)
            if value and value not in points:
                points.append(value[:180])
            if len(points) >= limit:
                break

        if points:
            return points

        sentences = re.split(r"[。；;]\s*", ChatService._clean_inline_text(content))
        for sentence in sentences:
            value = sentence.strip()
            if len(value) >= 8 and value not in points:
                points.append(value[:180])
            if len(points) >= min(3, limit):
                break
        return points

    @staticmethod
    def _note_summary(content: str, limit: int = 240) -> str:
        for paragraph in re.split(r"\n\s*\n", content):
            clean = ChatService._clean_inline_text(paragraph)
            if clean:
                return clean[:limit]
        return ChatService._clean_inline_text(content)[:limit]

    @staticmethod
    def _clean_inline_text(text: Optional[str]) -> str:
        return " ".join(str(text or "").split())

    @staticmethod
    def _clean_note_content(text: Optional[str]) -> str:
        value = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
        value = re.sub(r"[ \t\f\v]+", " ", value)
        value = re.sub(r"\n{3,}", "\n\n", value)
        return value.strip()

    @staticmethod
    def _normalize_tags(tags: Optional[Iterable[str]]) -> List[str]:
        normalized: List[str] = []
        for tag in tags or []:
            value = " ".join(str(tag or "").split())
            if not value or value in normalized:
                continue
            normalized.append(value[:32])
            if len(normalized) >= 8:
                break
        return normalized

    @classmethod
    def _tool_call_name(cls, tool_call: Dict[str, Any]) -> str:
        function = tool_call.get("function") or {}
        if not isinstance(function, dict):
            function = {}
        return cls._clean_inline_text(
            function.get("name")
            or tool_call.get("name")
            or tool_call.get("tool")
        )

    @classmethod
    def _parse_note_suggestion_tool_call(cls, tool_call: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if cls._tool_call_name(tool_call) != NOTE_SUGGESTION_TOOL_NAME:
            return None

        arguments = cls._parse_tool_call_arguments(tool_call)
        if arguments is None:
            logger.warning("Invalid propose_note tool arguments: %s", tool_call)
            return None

        content = cls._clean_note_content(arguments.get("content"))
        if len(content) < 4:
            return None
        title = cls._clean_inline_text(arguments.get("title"))[:255] or cls._suggestion_title(content)
        reason_value = arguments.get("reason")
        reason = cls._clean_inline_text(reason_value) if reason_value else None
        raw_tags = arguments.get("tags")
        tags = cls._normalize_tags(raw_tags if isinstance(raw_tags, list) else [])
        category = cls._clean_inline_text(arguments.get("category")) or None
        return {
            "title": title,
            "content": content,
            "category": category,
            "reason": reason,
            "tags": tags,
        }

    @classmethod
    def _parse_tool_call_arguments(cls, tool_call: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        function = tool_call.get("function") or {}
        if not isinstance(function, dict):
            function = {}

        raw_arguments = function.get("arguments") if "arguments" in function else None
        if raw_arguments is None:
            raw_arguments = tool_call.get("arguments")
        if raw_arguments is None:
            raw_arguments = tool_call.get("parameters")
        if raw_arguments is None:
            return {}
        if isinstance(raw_arguments, dict):
            return raw_arguments
        if isinstance(raw_arguments, str):
            return cls._try_parse_json(raw_arguments)
        return None

    @classmethod
    def _try_parse_json(cls, text: str) -> Optional[Dict[str, Any]]:
        raw_text = str(text or "").strip()
        if not raw_text:
            return {}

        candidates = [raw_text]
        translated = cls._translate_json_quotes(raw_text)
        if translated not in candidates:
            candidates.append(translated)
        extracted = cls._extract_json_value(translated)
        if extracted not in candidates:
            candidates.append(extracted)
        repaired = cls._repair_json_object(extracted)
        if repaired not in candidates:
            candidates.append(repaired)

        for candidate in candidates:
            try:
                decoded = json.loads(candidate)
            except (TypeError, json.JSONDecodeError):
                continue
            return decoded if isinstance(decoded, dict) else None
        return None

    @staticmethod
    def _translate_json_quotes(text: str) -> str:
        return text.translate(
            str.maketrans(
                {
                    "“": '"',
                    "”": '"',
                    "„": '"',
                    "‟": '"',
                    "‘": "'",
                    "’": "'",
                }
            )
        )

    @staticmethod
    def _extract_json_value(text: str) -> str:
        json_block = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
        if json_block:
            text = json_block.group(1).strip()

        first_brace = text.find("{")
        if first_brace == -1:
            return text.strip()
        last_brace = text.rfind("}")
        if last_brace > first_brace:
            return text[first_brace:last_brace + 1].strip()
        return text[first_brace:].strip()

    @classmethod
    def _repair_json_object(cls, text: str) -> str:
        repaired = re.sub(r",\s*([\]}])", r"\1", text.strip())
        repaired = cls._quote_bare_string_values(repaired)
        repaired = re.sub(r"\\(?![\"\\/bfnrtu])", r"\\\\", repaired)
        return cls._escape_control_chars_in_json_strings(repaired)

    @staticmethod
    def _quote_bare_string_values(text: str) -> str:
        pattern = re.compile(
            r'("(?P<key>title|content|category|reason)"\s*:\s*)'
            r'(?P<value>(?!\s*(?:null\b|true\b|false\b|[-\d\[\{"])).*?)'
            r'(?=(,\s*"(?:title|content|category|reason|tags)"\s*:)|(\s*\}))',
            re.DOTALL,
        )

        def replace(match: re.Match[str]) -> str:
            raw_value = match.group("value").strip()
            return f"{match.group(1)}{json.dumps(raw_value, ensure_ascii=False)}"

        return pattern.sub(replace, text)

    @staticmethod
    def _escape_control_chars_in_json_strings(text: str) -> str:
        chars: List[str] = []
        in_string = False
        escaped = False
        for char in text:
            if not in_string:
                chars.append(char)
                if char == '"':
                    in_string = True
                continue

            if escaped:
                chars.append(char)
                escaped = False
                continue
            if char == "\\":
                chars.append(char)
                escaped = True
                continue
            if char == '"':
                chars.append(char)
                in_string = False
                continue
            if char == "\n":
                chars.append("\\n")
                continue
            if char == "\r":
                chars.append("\\r")
                continue
            if char == "\t":
                chars.append("\\t")
                continue
            chars.append(char)
        return "".join(chars)
