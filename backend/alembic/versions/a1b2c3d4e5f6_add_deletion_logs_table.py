"""Add deletion_logs table for incremental sync support.

Revision ID: a1b2c3d4e5f6
Revises: 19033c202cc0
Create Date: 2026-03-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "19033c202cc0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create deletion_logs table for tracking note deletions."""

    op.create_table(
        "deletion_logs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("note_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 单列索引
    op.create_index("ix_deletion_logs_note_id", "deletion_logs", ["note_id"])
    op.create_index("ix_deletion_logs_user_id", "deletion_logs", ["user_id"])

    # 复合索引：加速增量同步查询 (WHERE user_id = ? AND deleted_at > ?)
    op.create_index(
        "ix_deletion_logs_user_deleted",
        "deletion_logs",
        ["user_id", "deleted_at"],
    )


def downgrade() -> None:
    """Drop deletion_logs table."""

    op.drop_index("ix_deletion_logs_user_deleted", table_name="deletion_logs")
    op.drop_index("ix_deletion_logs_user_id", table_name="deletion_logs")
    op.drop_index("ix_deletion_logs_note_id", table_name="deletion_logs")
    op.drop_table("deletion_logs")
