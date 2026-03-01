"""删除日志模型：记录笔记删除事件，用于客户端增量同步时感知已删除的笔记。"""

import uuid

from sqlalchemy import Column, String, DateTime, Index
from sqlalchemy.sql import func

from app.database import Base


class DeletionLog(Base):
    """删除日志 —— 记录笔记被删除的事件

    当笔记被硬删除时，在此表中插入一条记录，
    客户端增量同步时通过 deleted_at 过滤即可拿到被删除的笔记 ID。
    """

    __tablename__ = "deletion_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    note_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    deleted_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # 复合索引：加速增量同步查询 (WHERE user_id = ? AND deleted_at > ?)
    __table_args__ = (
        Index("ix_deletion_logs_user_deleted", "user_id", "deleted_at"),
    )

    def __repr__(self) -> str:
        return f"<DeletionLog(note_id={self.note_id}, user_id={self.user_id})>"
