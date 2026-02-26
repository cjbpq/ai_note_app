"""Initial schema managed by Alembic.

Revision ID: 19033c202cc0
Revises: 
Create Date: 2025-10-14 10:35:50.728189

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "19033c202cc0"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create core tables for the AI Note backend."""

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username", name="uq_users_username"),
    )

    op.create_table(
        "notes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("device_id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("image_url", sa.String(length=2048), nullable=False),
        sa.Column("image_filename", sa.String(length=255), nullable=False),
        sa.Column("image_size", sa.Integer(), nullable=False),
        sa.Column("original_text", sa.Text(), nullable=False),
        sa.Column("structured_data", sa.JSON(), nullable=False),
        sa.Column("is_favorite", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_notes_user_id"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notes_user_id", "notes", ["user_id"], unique=False)
    op.create_index("ix_notes_device_id", "notes", ["device_id"], unique=False)

    op.create_table(
        "prompt_profile_versions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("profile_key", sa.String(length=100), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("actor", sa.String(length=100), nullable=True),
        sa.Column("comment", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_prompt_profile_versions_profile_key", "prompt_profile_versions", ["profile_key"], unique=False)

    op.create_table(
        "admin_key_bindings",
        sa.Column("key_fingerprint", sa.String(length=128), nullable=False),
        sa.Column("actor", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("key_fingerprint"),
    )

    op.create_table(
        "upload_jobs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("device_id", sa.String(length=64), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("file_meta", sa.JSON(), nullable=False),
        sa.Column("storage", sa.JSON(), nullable=False),
        sa.Column("ocr_result", sa.JSON(), nullable=True),
        sa.Column("ai_result", sa.JSON(), nullable=True),
        sa.Column("error_logs", sa.JSON(), nullable=True),
        sa.Column("note_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], name="fk_upload_jobs_note_id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_upload_jobs_user_id"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_upload_jobs_user_id", "upload_jobs", ["user_id"], unique=False)
    op.create_index("ix_upload_jobs_device_id", "upload_jobs", ["device_id"], unique=False)
    op.create_index("ix_upload_jobs_note_id", "upload_jobs", ["note_id"], unique=False)


def downgrade() -> None:
    """Drop all tables created in upgrade."""

    op.drop_index("ix_upload_jobs_note_id", table_name="upload_jobs")
    op.drop_index("ix_upload_jobs_device_id", table_name="upload_jobs")
    op.drop_index("ix_upload_jobs_user_id", table_name="upload_jobs")
    op.drop_table("upload_jobs")

    op.drop_table("admin_key_bindings")

    op.drop_index("ix_prompt_profile_versions_profile_key", table_name="prompt_profile_versions")
    op.drop_table("prompt_profile_versions")

    op.drop_index("ix_notes_device_id", table_name="notes")
    op.drop_index("ix_notes_user_id", table_name="notes")
    op.drop_table("notes")

    op.drop_table("users")
