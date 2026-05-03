"""Add email_verification_codes table and user email_verified field.

Revision ID: c3d4e5f6g7h8
Revises: a1b2c3d4e5f6
Create Date: 2026-03-01 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6g7h8"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _duplicate_email_user_ids_sql() -> str:
    return """
        SELECT id
        FROM (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY email
                    ORDER BY created_at ASC, id ASC
                ) AS duplicate_rank
            FROM users
            WHERE email IS NOT NULL
        ) AS ranked_users
        WHERE duplicate_rank > 1
    """


def upgrade() -> None:
    """Add email verification support."""

    conn = op.get_bind()
    duplicate_user_ids = _duplicate_email_user_ids_sql()

    conn.execute(
        sa.text(
            f"""
            DELETE FROM upload_jobs
            WHERE user_id IN ({duplicate_user_ids})
               OR note_id IN (
                    SELECT id FROM notes WHERE user_id IN ({duplicate_user_ids})
               )
            """
        )
    )
    conn.execute(sa.text(f"DELETE FROM deletion_logs WHERE user_id IN ({duplicate_user_ids})"))
    conn.execute(sa.text(f"DELETE FROM notes WHERE user_id IN ({duplicate_user_ids})"))
    conn.execute(sa.text(f"DELETE FROM users WHERE id IN ({duplicate_user_ids})"))

    op.create_table(
        "email_verification_codes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=6), nullable=False),
        sa.Column("purpose", sa.String(length=20), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "is_used",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_email_codes_email", "email_verification_codes", ["email"])
    op.create_index(
        "ix_email_codes_email_purpose",
        "email_verification_codes",
        ["email", "purpose"],
    )

    op.add_column(
        "users",
        sa.Column(
            "email_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.create_index("ix_users_email_unique", "users", ["email"], unique=True)


def downgrade() -> None:
    """Revert email verification support."""

    op.drop_index("ix_users_email_unique", table_name="users")
    op.drop_column("users", "email_verified")
    op.drop_index("ix_email_codes_email_purpose", table_name="email_verification_codes")
    op.drop_index("ix_email_codes_email", table_name="email_verification_codes")
    op.drop_table("email_verification_codes")
