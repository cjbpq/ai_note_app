"""Add chat and RAG metadata tables.

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-05-03 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e5f6g7h8i9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6g7h8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "note_vector_chunks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("note_id", sa.String(length=36), nullable=False),
        sa.Column("chunk_id", sa.String(length=128), nullable=False),
        sa.Column("vector_id", sa.String(length=255), nullable=True),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("section_heading", sa.String(length=255), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], name="fk_note_vector_chunks_note_id"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "note_id", "chunk_id", name="uq_note_vector_chunks_user_note_chunk"),
    )
    op.create_index("ix_note_vector_chunks_user_id", "note_vector_chunks", ["user_id"])
    op.create_index("ix_note_vector_chunks_note_id", "note_vector_chunks", ["note_id"])
    op.create_index("ix_note_vector_chunks_vector_id", "note_vector_chunks", ["vector_id"])

    op.create_table(
        "chat_conversations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("parent_conversation_id", sa.String(length=36), nullable=True),
        sa.Column("forked_from_message_id", sa.String(length=36), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_chat_conversations_user_id"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_conversations_user_id", "chat_conversations", ["user_id"])
    op.create_index("ix_chat_conversations_parent_conversation_id", "chat_conversations", ["parent_conversation_id"])
    op.create_index("ix_chat_conversations_forked_from_message_id", "chat_conversations", ["forked_from_message_id"])
    op.create_index("ix_chat_conversations_is_deleted", "chat_conversations", ["is_deleted"])

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("conversation_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["chat_conversations.id"], name="fk_chat_messages_conversation_id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_chat_messages_user_id"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("conversation_id", "sequence", name="uq_chat_messages_conversation_sequence"),
    )
    op.create_index("ix_chat_messages_conversation_id", "chat_messages", ["conversation_id"])
    op.create_index("ix_chat_messages_user_id", "chat_messages", ["user_id"])
    op.create_index("ix_chat_messages_conversation_sequence", "chat_messages", ["conversation_id", "sequence"])

    op.create_table(
        "chat_note_suggestions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("conversation_id", sa.String(length=36), nullable=False),
        sa.Column("message_id", sa.String(length=36), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("note_id", sa.String(length=36), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["chat_conversations.id"], name="fk_chat_note_suggestions_conversation_id"),
        sa.ForeignKeyConstraint(["message_id"], ["chat_messages.id"], name="fk_chat_note_suggestions_message_id"),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], name="fk_chat_note_suggestions_note_id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_chat_note_suggestions_user_id"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_note_suggestions_user_id", "chat_note_suggestions", ["user_id"])
    op.create_index("ix_chat_note_suggestions_conversation_id", "chat_note_suggestions", ["conversation_id"])
    op.create_index("ix_chat_note_suggestions_message_id", "chat_note_suggestions", ["message_id"])
    op.create_index("ix_chat_note_suggestions_status", "chat_note_suggestions", ["status"])
    op.create_index("ix_chat_note_suggestions_note_id", "chat_note_suggestions", ["note_id"])


def downgrade() -> None:
    op.drop_index("ix_chat_note_suggestions_note_id", table_name="chat_note_suggestions")
    op.drop_index("ix_chat_note_suggestions_status", table_name="chat_note_suggestions")
    op.drop_index("ix_chat_note_suggestions_message_id", table_name="chat_note_suggestions")
    op.drop_index("ix_chat_note_suggestions_conversation_id", table_name="chat_note_suggestions")
    op.drop_index("ix_chat_note_suggestions_user_id", table_name="chat_note_suggestions")
    op.drop_table("chat_note_suggestions")

    op.drop_index("ix_chat_messages_conversation_sequence", table_name="chat_messages")
    op.drop_index("ix_chat_messages_user_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_conversation_id", table_name="chat_messages")
    op.drop_table("chat_messages")

    op.drop_index("ix_chat_conversations_is_deleted", table_name="chat_conversations")
    op.drop_index("ix_chat_conversations_forked_from_message_id", table_name="chat_conversations")
    op.drop_index("ix_chat_conversations_parent_conversation_id", table_name="chat_conversations")
    op.drop_index("ix_chat_conversations_user_id", table_name="chat_conversations")
    op.drop_table("chat_conversations")

    op.drop_index("ix_note_vector_chunks_vector_id", table_name="note_vector_chunks")
    op.drop_index("ix_note_vector_chunks_note_id", table_name="note_vector_chunks")
    op.drop_index("ix_note_vector_chunks_user_id", table_name="note_vector_chunks")
    op.drop_table("note_vector_chunks")
