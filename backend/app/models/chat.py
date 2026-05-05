import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class NoteVectorChunk(Base):
    """Local metadata for note chunks mirrored into NexoraDB."""

    __tablename__ = "note_vector_chunks"
    __table_args__ = (
        UniqueConstraint("user_id", "note_id", "chunk_id", name="uq_note_vector_chunks_user_note_chunk"),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    note_id = Column(String(36), ForeignKey("notes.id"), nullable=False, index=True)
    chunk_id = Column(String(128), nullable=False)
    vector_id = Column(String(255), nullable=True, index=True)
    content_hash = Column(String(64), nullable=False)
    section_heading = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)
    chunk_metadata = Column("metadata", JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ChatConversation(Base):
    """Persistent chat conversation owned by a user."""

    __tablename__ = "chat_conversations"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    parent_conversation_id = Column(String(36), nullable=True, index=True)
    forked_from_message_id = Column(String(36), nullable=True, index=True)
    context_summary = Column(Text, nullable=True)
    context_compacted_until_sequence = Column(Integer, nullable=True)
    context_summary_updated_at = Column(DateTime(timezone=True), nullable=True)
    is_deleted = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ChatMessage(Base):
    """Persistent message in a chat conversation."""

    __tablename__ = "chat_messages"
    __table_args__ = (
        UniqueConstraint("conversation_id", "sequence", name="uq_chat_messages_conversation_sequence"),
        Index("ix_chat_messages_conversation_sequence", "conversation_id", "sequence"),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    conversation_id = Column(String(36), ForeignKey("chat_conversations.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(32), nullable=False)
    content = Column(Text, nullable=False, default="")
    sequence = Column(Integer, nullable=False)
    message_metadata = Column("metadata", JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ChatNoteSuggestion(Base):
    """Pending user-approved note creation suggestion from chat."""

    __tablename__ = "chat_note_suggestions"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    conversation_id = Column(String(36), ForeignKey("chat_conversations.id"), nullable=False, index=True)
    message_id = Column(String(36), ForeignKey("chat_messages.id"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(100), nullable=True, default="聊天补充")
    tags = Column(JSON, nullable=False, default=list)
    status = Column(String(32), nullable=False, default="pending", index=True)
    note_id = Column(String(36), ForeignKey("notes.id"), nullable=True, index=True)
    suggestion_metadata = Column("metadata", JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
