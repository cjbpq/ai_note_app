"""Add email_verification_codes table and user email_verified field.

清理测试数据中的重复邮箱用户，然后：
1. 创建 email_verification_codes 表
2. users 表添加 email_verified 列
3. users.email 添加唯一索引

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


def upgrade() -> None:
    """Add email verification support."""

    # ── 1. 清理重复邮箱的测试用户 ──
    # 找到重复邮箱，保留每组中最早创建的，删除其余的
    conn = op.get_bind()

    # 先删除重复邮箱用户关联的 notes、upload_jobs、deletion_logs
    conn.execute(sa.text("""
        DELETE FROM notes WHERE user_id IN (
            SELECT id FROM users
            WHERE email IS NOT NULL
              AND email IN (
                  SELECT email FROM users
                  WHERE email IS NOT NULL
                  GROUP BY email HAVING COUNT(*) > 1
              )
              AND id NOT IN (
                  SELECT DISTINCT ON (email) id FROM users
                  WHERE email IS NOT NULL
                  ORDER BY email, created_at ASC
              )
        )
    """))
    conn.execute(sa.text("""
        DELETE FROM upload_jobs WHERE user_id IN (
            SELECT id FROM users
            WHERE email IS NOT NULL
              AND email IN (
                  SELECT email FROM users
                  WHERE email IS NOT NULL
                  GROUP BY email HAVING COUNT(*) > 1
              )
              AND id NOT IN (
                  SELECT DISTINCT ON (email) id FROM users
                  WHERE email IS NOT NULL
                  ORDER BY email, created_at ASC
              )
        )
    """))
    conn.execute(sa.text("""
        DELETE FROM deletion_logs WHERE user_id IN (
            SELECT id FROM users
            WHERE email IS NOT NULL
              AND email IN (
                  SELECT email FROM users
                  WHERE email IS NOT NULL
                  GROUP BY email HAVING COUNT(*) > 1
              )
              AND id NOT IN (
                  SELECT DISTINCT ON (email) id FROM users
                  WHERE email IS NOT NULL
                  ORDER BY email, created_at ASC
              )
        )
    """))
    # 删除重复邮箱用户（保留最早创建的）
    conn.execute(sa.text("""
        DELETE FROM users
        WHERE email IS NOT NULL
          AND email IN (
              SELECT email FROM users
              WHERE email IS NOT NULL
              GROUP BY email HAVING COUNT(*) > 1
          )
          AND id NOT IN (
              SELECT DISTINCT ON (email) id FROM users
              WHERE email IS NOT NULL
              ORDER BY email, created_at ASC
          )
    """))

    # ── 2. 创建 email_verification_codes 表 ──
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

    # ── 3. users 表添加 email_verified 列 ──
    op.add_column(
        "users",
        sa.Column(
            "email_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # ── 4. users.email 添加唯一索引 ──
    op.create_index("ix_users_email_unique", "users", ["email"], unique=True)


def downgrade() -> None:
    """Revert email verification support."""

    op.drop_index("ix_users_email_unique", table_name="users")
    op.drop_column("users", "email_verified")
    op.drop_index("ix_email_codes_email_purpose", table_name="email_verification_codes")
    op.drop_index("ix_email_codes_email", table_name="email_verification_codes")
    op.drop_table("email_verification_codes")
