from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
import uuid

from pydantic import BaseModel, Field


class ChatReference(BaseModel):
    note_id: uuid.UUID
    title: str
    chunk_id: str
    section_heading: Optional[str] = None
    snippet: str
    score: Optional[float] = None


class ChatStreamRequest(BaseModel):
    conversation_id: Optional[uuid.UUID] = None
    message: str = Field(...)
    referenced_note_ids: List[uuid.UUID] = Field(default_factory=list, max_length=20)
    rag_top_k: Optional[int] = Field(default=None, ge=1, le=20)


class ChatConversationResponse(BaseModel):
    id: uuid.UUID
    title: str
    parent_conversation_id: Optional[uuid.UUID] = None
    forked_from_message_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime


class ChatNoteSuggestionResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    message_id: Optional[uuid.UUID] = None
    title: str
    content: str
    category: Optional[str] = None
    tags: List[str]
    status: Literal["pending", "accepted", "dismissed"]
    note_id: Optional[uuid.UUID] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    role: Literal["user", "assistant", "system"]
    content: str
    sequence: int
    metadata: Dict[str, Any] = Field(default_factory=dict)
    suggestions: List[ChatNoteSuggestionResponse] = Field(default_factory=list)
    created_at: datetime


class ChatConversationListResponse(BaseModel):
    conversations: List[ChatConversationResponse]
    total: int


class ChatConversationDetailResponse(BaseModel):
    conversation: ChatConversationResponse
    messages: List[ChatMessageResponse]


class ChatConversationSearchResponse(BaseModel):
    conversations: List[ChatConversationResponse]
    total: int


class ChatConversationBatchDeleteRequest(BaseModel):
    conversation_ids: List[uuid.UUID] = Field(..., min_length=1, max_length=100)


class ChatConversationBatchDeleteResponse(BaseModel):
    deleted_count: int
    not_found_ids: List[str]


class ChatConversationForkRequest(BaseModel):
    from_message_id: uuid.UUID


class ChatSuggestionAcceptResponse(BaseModel):
    suggestion: ChatNoteSuggestionResponse
    note_id: uuid.UUID


class ChatIndexRebuildResponse(BaseModel):
    indexed_notes: int
    indexed_chunks: int
    skipped_notes: int
