"""Add chat compact state and user chat preferences.

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-05-05 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e5f6g7h8i9j0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6g7h8i9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("chat_thinking_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("chat_conversations", sa.Column("context_summary", sa.Text(), nullable=True))
    op.add_column("chat_conversations", sa.Column("context_compacted_until_sequence", sa.Integer(), nullable=True))
    op.add_column("chat_conversations", sa.Column("context_summary_updated_at", sa.DateTime(timezone=True), nullable=True))
    if op.get_bind().dialect.name != "sqlite":
        op.alter_column("users", "chat_thinking_enabled", server_default=None)


def downgrade() -> None:
    op.drop_column("chat_conversations", "context_summary_updated_at")
    op.drop_column("chat_conversations", "context_compacted_until_sequence")
    op.drop_column("chat_conversations", "context_summary")
    op.drop_column("users", "chat_thinking_enabled")
