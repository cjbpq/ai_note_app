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
    ChatStreamRequest,
    ChatSuggestionAcceptResponse,
)
from app.services.chat_service import (
    ChatAccessError,
    ChatNotFoundError,
    ChatService,
    classify_chat_intent,
)
from app.services.doubao_service import DoubaoServiceError
from app.services.note_index_service import NoteIndexService
from app.services.nexoradb_service import NexoraDBError

router = APIRouter()


def _sse(event: str, data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


def _heartbeat() -> str:
    return ": heartbeat\n\n"


def _conversation_response(service: ChatService, conversation) -> ChatConversationResponse:
    return ChatConversationResponse(**service.serialize_conversation(conversation))


def _message_response(service: ChatService, message) -> ChatMessageResponse:
    return ChatMessageResponse(**service.serialize_message(message))


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

            service.add_message(
                user_id=current_user.id,
                conversation_id=conversation.id,
                role="user",
                content=body.message,
                metadata={"referenced_note_ids": [str(item) for item in body.referenced_note_ids]},
            )
            intent = classify_chat_intent(body.message)
            references = []
            if intent == "note_question":
                references = service.retrieve_references(
                    user_id=current_user.id,
                    message=body.message,
                    referenced_note_ids=[str(item) for item in body.referenced_note_ids],
                    top_k=body.rag_top_k,
                    query_vector=True,
                )
            elif body.referenced_note_ids:
                references = service.retrieve_references(
                    user_id=current_user.id,
                    message=body.message,
                    referenced_note_ids=[str(item) for item in body.referenced_note_ids],
                    top_k=body.rag_top_k,
                    query_vector=False,
                )

            public_refs = [{key: ref.get(key) for key in ("note_id", "title", "chunk_id", "section_heading", "snippet", "score")} for ref in references]
            yield _sse("retrieval", {"intent": intent, "references": public_refs})

            model_messages = service.build_model_messages(
                user_id=current_user.id,
                conversation_id=conversation.id,
                intent=intent,
                references=references,
            )
            model_events: queue.Queue[tuple[str, object]] = queue.Queue()

            def stream_worker() -> None:
                try:
                    for delta_item in service.model_service.stream_chat(model_messages):
                        model_events.put(("delta", delta_item))
                    model_events.put(("done", None))
                except Exception as exc:  # noqa: BLE001
                    model_events.put(("error", exc))

            threading.Thread(target=stream_worker, name="chat-model-stream", daemon=True).start()
            heartbeat_seconds = max(0.1, float(settings.CHAT_STREAM_HEARTBEAT_SECONDS or 12))

            while True:
                try:
                    event_type, payload = model_events.get(timeout=heartbeat_seconds)
                except queue.Empty:
                    yield _heartbeat()
                    continue

                if event_type == "done":
                    break
                if event_type == "error":
                    raise payload

                delta = str(payload or "")
                if not delta:
                    continue
                assistant_text += delta
                yield _sse("delta", {"delta": delta})

            assistant_message = service.add_message(
                user_id=current_user.id,
                conversation_id=conversation.id,
                role="assistant",
                content=assistant_text,
                metadata={"intent": intent, "references": public_refs},
            )

            suggestion_payload = None
            if intent == "out_of_scope_note_worthy":
                suggestion = service.create_note_suggestion(
                    user_id=current_user.id,
                    conversation_id=conversation.id,
                    message_id=assistant_message.id,
                    source_message=body.message,
                )
                suggestion_payload = service.serialize_suggestion(suggestion)
                yield _sse("note_suggestion", suggestion_payload)

            yield _sse(
                "done",
                {
                    "conversation_id": conversation.id,
                    "message_id": assistant_message.id if assistant_message else None,
                    "suggestion_id": suggestion_payload.get("id") if suggestion_payload else None,
                },
            )
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
    return ChatConversationDetailResponse(
        conversation=_conversation_response(service, conversation),
        messages=[_message_response(service, message) for message in messages],
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ChatService(db)
    try:
        suggestion = service.accept_suggestion(user_id=current_user.id, suggestion_id=str(suggestion_id))
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
