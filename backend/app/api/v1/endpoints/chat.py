import json
import queue
import threading
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.chat import (
    ChatConversationBatchDeleteRequest,
    ChatConversationBatchDeleteResponse,
    ChatConversationDetailResponse,
    ChatConversationForkRequest,
    ChatConversationListResponse,
    ChatConversationResponse,
    ChatConversationSearchResponse,
    ChatIndexRebuildResponse,
    ChatMessageResponse,
    ChatNoteSuggestionResponse,
    ChatSuggestionAcceptRequest,
    ChatStreamRequest,
    ChatSuggestionAcceptResponse,
)
from app.services.chat_service import (
    ChatAccessError,
    ChatNotFoundError,
    ChatService,
    ToolCallLoopGuard,
    classify_chat_intent,
    should_enable_note_suggestion_tool,
)
from app.services.doubao_service import DoubaoServiceError
from app.services.note_index_service import NoteIndexService
from app.services.nexoradb_service import NexoraDBError

router = APIRouter()
ASSISTANT_TEXT_FALLBACK = "工具调用已完成，但模型没有返回可展示的文字回复。"


def _sse(event: str, data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


def _heartbeat() -> str:
    return ": heartbeat\n\n"


def _stream_event_parts(payload: object) -> tuple[str, str, dict | None]:
    kind = getattr(payload, "kind", None)
    if kind:
        return str(kind), str(getattr(payload, "text", "") or ""), getattr(payload, "data", None)

    return "text_delta", str(payload or ""), None


def _tool_call_sse_payload(service: ChatService, tool_call: dict) -> dict:
    return {
        "id": tool_call.get("id"),
        "call_id": tool_call.get("id"),
        "index": tool_call.get("index"),
        "name": service._tool_call_name(tool_call),  # noqa: SLF001 - endpoint serializes model tool events.
        "arguments": service._parse_tool_call_arguments(tool_call) or {},  # noqa: SLF001
    }


def _conversation_response(service: ChatService, conversation) -> ChatConversationResponse:
    return ChatConversationResponse(**service.serialize_conversation(conversation))


def _message_response(service: ChatService, message, suggestions=None) -> ChatMessageResponse:
    return ChatMessageResponse(**service.serialize_message(message, suggestions=suggestions))


def _suggestion_response(service: ChatService, suggestion) -> ChatNoteSuggestionResponse:
    return ChatNoteSuggestionResponse(**service.serialize_suggestion(suggestion))


@router.post(
    "/stream",
    summary="流式 AI 笔记对话",
    description="创建或继续一个笔记感知对话，使用 SSE 返回检索结果、模型增量输出、笔记建议和完成事件。",
)
async def stream_chat(
    body: ChatStreamRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    def event_generator():
        service = ChatService(db)
        assistant_text = ""
        reasoning_text = ""
        assistant_message = None
        try:
            if not body.message.strip():
                yield _sse(
                    "done",
                    {
                        "ignored": True,
                        "reason": "empty_message",
                        "conversation_id": None,
                        "message_id": None,
                        "suggestion_id": None,
                    },
                )
                return

            conversation = service.get_or_create_conversation(
                user_id=current_user.id,
                conversation_id=str(body.conversation_id) if body.conversation_id else None,
                first_message=body.message,
            )
            yield _sse("conversation_id", {"conversation_id": conversation.id})

            requested_note_ids = [str(item) for item in body.referenced_note_ids]
            service.add_message(
                user_id=current_user.id,
                conversation_id=conversation.id,
                role="user",
                content=body.message,
                metadata={"referenced_note_ids": requested_note_ids},
            )
            intent = classify_chat_intent(body.message)
            references = []
            if requested_note_ids or intent == "note_question":
                references = service.retrieve_references(
                    user_id=current_user.id,
                    message=body.message,
                    referenced_note_ids=requested_note_ids,
                    top_k=body.rag_top_k,
                    query_vector=intent == "note_question",
                )

            public_refs = [{key: ref.get(key) for key in ("note_id", "title", "chunk_id", "section_heading", "snippet", "score")} for ref in references]
            effective_note_ids = []
            for ref in public_refs:
                note_id = ref.get("note_id")
                if note_id and note_id not in effective_note_ids:
                    effective_note_ids.append(note_id)
            yield _sse(
                "retrieval",
                {
                    "intent": intent,
                    "references": public_refs,
                    "requested_note_ids": requested_note_ids,
                    "effective_note_ids": effective_note_ids,
                    "reference_count": len(public_refs),
                },
            )

            note_tool_enabled = should_enable_note_suggestion_tool(
                intent=intent,
                references=references,
                message_length=len(body.message),
            )
            model_messages = service.build_model_messages(
                user_id=current_user.id,
                conversation_id=conversation.id,
                intent=intent,
                references=references,
                note_tool_enabled=note_tool_enabled,
            )
            note_tools = service.build_note_suggestion_tools() if note_tool_enabled else None
            usage_payload = None
            all_tool_calls = []
            loop_guard = ToolCallLoopGuard()

            def stream_worker(messages_for_model, event_queue: queue.Queue[tuple[str, object]]) -> None:
                try:
                    stream_kwargs = {"tools": note_tools} if note_tools else {}
                    stream_kwargs["thinking_enabled"] = bool(current_user.chat_thinking_enabled)
                    for delta_item in service.model_service.stream_chat(messages_for_model, **stream_kwargs):
                        event_queue.put(("delta", delta_item))
                    event_queue.put(("done", None))
                except Exception as exc:  # noqa: BLE001
                    event_queue.put(("error", exc))

            heartbeat_seconds = max(0.1, float(settings.CHAT_STREAM_HEARTBEAT_SECONDS or 12))
            context_retry_count = 0
            max_context_retries = 1

            for round_num in range(1, loop_guard.max_rounds + 1):
                round_text = ""
                round_tool_calls = []
                model_events: queue.Queue[tuple[str, object]] = queue.Queue()
                worker_thread = threading.Thread(
                    target=stream_worker,
                    args=(model_messages, model_events),
                    name="chat-model-stream",
                    daemon=True,
                )
                worker_thread.start()
                retry_after_context_error = False
                while True:
                    try:
                        event_type, payload = model_events.get(timeout=heartbeat_seconds)
                    except queue.Empty:
                        yield _heartbeat()
                        continue

                    if event_type == "done":
                        break
                    if event_type == "error":
                        is_context_error = bool(
                            hasattr(service.model_service, "is_context_length_error")
                            and service.model_service.is_context_length_error(payload)
                        )
                        if (
                            is_context_error
                            and context_retry_count < max_context_retries
                            and not assistant_text
                            and not reasoning_text
                            and not all_tool_calls
                        ):
                            context_retry_count += 1
                            model_messages = service.build_model_messages(
                                user_id=current_user.id,
                                conversation_id=conversation.id,
                                intent=intent,
                                references=references,
                                note_tool_enabled=note_tool_enabled,
                                force_compact=True,
                                force_reference_summary=True,
                            )
                            retry_after_context_error = True
                            break
                        raise payload

                    kind, text, data = _stream_event_parts(payload)
                    if kind == "tool_call":
                        if not note_tool_enabled:
                            continue
                        tool_call = data or {}
                        if isinstance(tool_call, dict):
                            round_tool_calls.append(tool_call)
                            yield _sse("tool_call", _tool_call_sse_payload(service, tool_call))
                        continue
                    if kind == "usage":
                        usage_payload = data or {}
                        yield _sse("usage", usage_payload)
                        continue
                    if kind == "reasoning_delta":
                        if text:
                            reasoning_text += text
                            yield _sse("reasoning_delta", {"delta": text})
                        continue
                    if kind == "text_delta" and text:
                        round_text += text
                        assistant_text += text
                        yield _sse("delta", {"delta": text})
                if retry_after_context_error:
                    worker_thread.join(timeout=1.0)
                    continue

                worker_thread.join(timeout=1.0)
                if not round_tool_calls:
                    break

                all_tool_calls.extend(round_tool_calls)
                guard_reason = loop_guard.check(
                    round_num=round_num,
                    has_text=bool(round_text.strip()),
                    tool_calls=round_tool_calls,
                )
                if guard_reason:
                    yield _sse("tool_loop_guard", {"reason": guard_reason})
                    break

                model_messages.append(
                    {
                        "role": "assistant",
                        "content": round_text or None,
                        "tool_calls": round_tool_calls,
                    }
                )
                for tool_call in round_tool_calls:
                    result = service.execute_note_suggestion_tool(
                        user_id=current_user.id,
                        conversation_id=conversation.id,
                        tool_call=tool_call,
                        source_message=body.message,
                    )
                    result_payload = result.as_dict()
                    yield _sse(
                        "tool_result",
                        {
                            "call_id": tool_call.get("id"),
                            "name": service._tool_call_name(tool_call),  # noqa: SLF001
                            **result_payload,
                        },
                    )
                    model_messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call.get("id"),
                            "content": json.dumps(result_payload, ensure_ascii=False, default=str),
                        }
                    )
            else:
                yield _sse("tool_loop_guard", {"reason": "max_rounds"})

            assistant_metadata = {"intent": intent, "references": public_refs}
            if reasoning_text:
                assistant_metadata["reasoning_content"] = reasoning_text
            if usage_payload:
                assistant_metadata["usage"] = usage_payload
            if all_tool_calls:
                assistant_metadata["tool_calls"] = all_tool_calls
            if not assistant_text.strip():
                assistant_text = ASSISTANT_TEXT_FALLBACK
            assistant_message = service.add_message(
                user_id=current_user.id,
                conversation_id=conversation.id,
                role="assistant",
                content=assistant_text,
                metadata=assistant_metadata,
            )

            suggestion_payloads = []
            suggestions_for_this_turn = service.get_suggestions_by_tool_call_ids(
                user_id=current_user.id,
                conversation_id=conversation.id,
                tool_call_ids=[tool_call.get("id") for tool_call in all_tool_calls],
            )
            for suggestion in suggestions_for_this_turn:
                suggestion.message_id = assistant_message.id
                service.db.add(suggestion)
            if suggestions_for_this_turn:
                service.db.commit()
                for suggestion in suggestions_for_this_turn:
                    service.db.refresh(suggestion)
                    payload = service.serialize_suggestion(suggestion)
                    suggestion_payloads.append(payload)
                    yield _sse("note_suggestion", payload)

            done_payload = {
                "conversation_id": conversation.id,
                "message_id": assistant_message.id if assistant_message else None,
                "suggestion_id": suggestion_payloads[0].get("id") if suggestion_payloads else None,
                "reasoning_content": reasoning_text or None,
            }
            if len(suggestion_payloads) > 1:
                done_payload["suggestion_ids"] = [item.get("id") for item in suggestion_payloads]
            if usage_payload:
                done_payload["usage"] = usage_payload
            yield _sse("done", done_payload)
        except ChatAccessError as exc:
            yield _sse("error", {"error": "access_denied", "detail": str(exc)})
        except ChatNotFoundError as exc:
            yield _sse("error", {"error": "not_found", "detail": str(exc)})
        except NexoraDBError as exc:
            yield _sse("error", {"error": "nexoradb_unavailable", "detail": str(exc)})
        except DoubaoServiceError as exc:
            yield _sse("error", {"error": "doubao_unavailable", "detail": str(exc)})
        except Exception as exc:  # noqa: BLE001
            yield _sse("error", {"error": "chat_stream_failed", "detail": str(exc)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get(
    "/conversations",
    response_model=ChatConversationListResponse,
    summary="列出对话",
)
async def list_conversations(
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ChatService(db)
    conversations, total = service.list_conversations(user_id=current_user.id, skip=skip, limit=limit)
    return ChatConversationListResponse(
        conversations=[_conversation_response(service, item) for item in conversations],
        total=total,
    )


@router.get(
    "/conversations/search",
    response_model=ChatConversationSearchResponse,
    summary="搜索对话历史",
)
async def search_conversations(
    q: str = Query(..., min_length=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ChatService(db)
    conversations = service.search_conversations(user_id=current_user.id, query_text=q, limit=limit)
    return ChatConversationSearchResponse(
        conversations=[_conversation_response(service, item) for item in conversations],
        total=len(conversations),
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=ChatConversationDetailResponse,
    summary="获取对话详情",
)
async def get_conversation_detail(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ChatService(db)
    conversation = service.get_conversation(user_id=current_user.id, conversation_id=str(conversation_id))
    if conversation is None:
        raise HTTPException(status_code=404, detail="对话不存在")
    messages = service.get_messages(user_id=current_user.id, conversation_id=str(conversation_id))
    suggestions_by_message_id = service.ensure_suggestions_for_messages(
        user_id=current_user.id,
        conversation_id=str(conversation_id),
        messages=messages,
    )
    return ChatConversationDetailResponse(
        conversation=_conversation_response(service, conversation),
        messages=[
            _message_response(
                service,
                message,
                suggestions=suggestions_by_message_id.get(str(message.id), []),
            )
            for message in messages
        ],
    )


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除单个对话",
)
async def delete_conversation(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ChatService(db)
    if not service.soft_delete_conversation(user_id=current_user.id, conversation_id=str(conversation_id)):
        raise HTTPException(status_code=404, detail="对话不存在")
    return None


@router.post(
    "/conversations/batch-delete",
    response_model=ChatConversationBatchDeleteResponse,
    summary="批量删除对话",
)
async def batch_delete_conversations(
    body: ChatConversationBatchDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ChatService(db)
    result = service.batch_delete_conversations(
        user_id=current_user.id,
        conversation_ids=[str(item) for item in body.conversation_ids],
    )
    return ChatConversationBatchDeleteResponse(**result)


@router.post(
    "/conversations/{conversation_id}/fork",
    response_model=ChatConversationResponse,
    summary="从指定消息分叉对话",
)
async def fork_conversation(
    conversation_id: uuid.UUID,
    body: ChatConversationForkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ChatService(db)
    try:
        fork = service.fork_conversation(
            user_id=current_user.id,
            conversation_id=str(conversation_id),
            from_message_id=str(body.from_message_id),
        )
    except ChatNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _conversation_response(service, fork)


@router.post(
    "/suggestions/{suggestion_id}/accept",
    response_model=ChatSuggestionAcceptResponse,
    summary="接受聊天生成的笔记建议",
)
async def accept_suggestion(
    suggestion_id: uuid.UUID,
    body: ChatSuggestionAcceptRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ChatService(db)
    try:
        suggestion = service.accept_suggestion(
            user_id=current_user.id,
            suggestion_id=str(suggestion_id),
            category=body.category if body else None,
        )
    except ChatNotFoundError as exc:
        raise HTTPException(status_code=404, detail="建议不存在") from exc
    except ChatAccessError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return ChatSuggestionAcceptResponse(
        suggestion=_suggestion_response(service, suggestion),
        note_id=suggestion.note_id,
    )


@router.post(
    "/suggestions/{suggestion_id}/dismiss",
    response_model=ChatNoteSuggestionResponse,
    summary="忽略聊天生成的笔记建议",
)
async def dismiss_suggestion(
    suggestion_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ChatService(db)
    try:
        suggestion = service.dismiss_suggestion(user_id=current_user.id, suggestion_id=str(suggestion_id))
    except ChatNotFoundError as exc:
        raise HTTPException(status_code=404, detail="建议不存在") from exc
    return _suggestion_response(service, suggestion)


@router.post(
    "/index/rebuild",
    response_model=ChatIndexRebuildResponse,
    summary="重建当前用户的笔记向量索引",
)
async def rebuild_index(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = NoteIndexService(db).rebuild_user_index(user_id=current_user.id)
    return ChatIndexRebuildResponse(**result)
