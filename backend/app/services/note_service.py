from typing import Dict, Any, List, Optional, Union
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, load_only

from app.models.note import Note
from app.models.deletion_log import DeletionLog
from app.core.exceptions import NoteNotFoundError

logger = logging.getLogger(__name__)


class NoteService:
    """笔记相关业务逻辑"""

    # 列表接口只需要加载的字段（排除 original_text 和 structured_data）
    SUMMARY_FIELDS = [
        Note.id, Note.user_id, Note.device_id,
        Note.title, Note.category, Note.tags,
        Note.image_urls, Note.image_filenames, Note.image_sizes,
        Note.is_favorite, Note.is_archived,
        Note.created_at, Note.updated_at,
    ]

    def __init__(self, db: Session):
        self.db = db

    def _normalize_note_payload(self, note_data: Dict[str, Any]) -> Dict[str, Any]:
        payload = dict(note_data)

        # Backward compatibility for legacy single-image fields.
        if "image_url" in payload and "image_urls" not in payload:
            payload["image_urls"] = [payload.pop("image_url")]
        if "image_filename" in payload and "image_filenames" not in payload:
            payload["image_filenames"] = [payload.pop("image_filename")]
        if "image_size" in payload and "image_sizes" not in payload:
            payload["image_sizes"] = [payload.pop("image_size")]

        payload.setdefault("image_urls", [])
        payload.setdefault("image_filenames", [])
        payload.setdefault("image_sizes", [])
        payload.setdefault("tags", [])
        payload.setdefault("category", "学习笔记")
        return payload

    def create_note(self, note_data: Dict[str, Any], user_id: str, *, device_id: Optional[str] = None) -> Note:
        """创建笔记

        学习要点:
        - 在关键业务操作中添加日志记录
        - logger.info 用于记录正常业务操作 (如笔记创建)
        - extra 参数提供结构化日志上下文 (user_id, category 等)
        """
        normalized = self._normalize_note_payload(note_data)
        logger.info(f"创建笔记: user_id={user_id}, category={normalized.get('category')}")
        now = datetime.now(timezone.utc)
        note = Note(
            user_id=user_id,
            device_id=device_id or user_id,
            created_at=now,
            updated_at=now,
            **normalized,
        )
        self.db.add(note)
        self.db.commit()
        self.db.refresh(note)
        logger.debug(f"笔记已创建: note_id={note.id}")
        return note

    def _ownership_filter(self, user_id: str):
        return or_(Note.user_id == user_id, and_(Note.user_id.is_(None), Note.device_id == user_id))

    def get_user_notes(self, user_id: str, skip: int = 0, limit: int = 100) -> List[Note]:
        """获取用户笔记列表（轻量级，不加载大字段）"""
        return (
            self.db.query(Note)
            .options(load_only(*self.SUMMARY_FIELDS))
            .filter(self._ownership_filter(user_id), Note.is_archived.is_(False))
            .order_by(Note.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def _normalize_id(self, note_id: Union[str, uuid.UUID]) -> str:
        return str(note_id)

    def get_note_by_id(self, note_id: Union[str, uuid.UUID], user_id: str) -> Optional[Note]:
        """获取完整笔记详情（包含所有字段）"""
        return (
            self.db.query(Note)
            .filter(
                Note.id == self._normalize_id(note_id),
                self._ownership_filter(user_id),
                Note.is_archived.is_(False),
            )
            .first()
        )

    def get_note_summary_by_id(self, note_id: Union[str, uuid.UUID], user_id: str) -> Optional[Note]:
        """获取轻量级笔记摘要（不包含大字段）"""
        return (
            self.db.query(Note)
            .options(load_only(*self.SUMMARY_FIELDS))
            .filter(
                Note.id == self._normalize_id(note_id),
                self._ownership_filter(user_id),
                Note.is_archived.is_(False),
            )
            .first()
        )

    def update_note(
        self,
        note_id: Union[str, uuid.UUID],
        user_id: str,
        update_data: Dict[str, Any],
    ) -> Optional[Note]:
        note = self.get_note_by_id(note_id, user_id)
        if not note:
            return None

        for key, value in update_data.items():
            setattr(note, key, value)
        # Keep microsecond precision for incremental sync cursors.
        note.updated_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(note)
        return note

    def delete_note(self, note_id: Union[str, uuid.UUID], user_id: str) -> bool:
        """删除笔记并记录到 DeletionLog

        学习要点:
        - 敏感操作使用 logger.warning 级别记录
        - 记录关键信息 (note_id, user_id, title) 便于审计
        - 同时写入 deletion_logs 表，支持客户端增量同步感知删除
        """
        note = self.get_note_by_id(note_id, user_id)
        if not note:
            return False

        normalized_id = self._normalize_id(note_id)
        logger.warning(f"笔记删除: note_id={normalized_id}, user_id={user_id}, title={note.title}")

        # 记录删除事件（供增量同步使用）
        deletion_entry = DeletionLog(
            note_id=normalized_id,
            user_id=user_id,
            deleted_at=datetime.now(timezone.utc),
        )
        self.db.add(deletion_entry)
        self.db.delete(note)
        self.db.commit()
        return True

    def toggle_favorite(self, note_id: Union[str, uuid.UUID], user_id: str) -> Optional[Note]:
        note = self.get_note_by_id(note_id, user_id)
        if not note:
            return None

        note.is_favorite = not note.is_favorite
        note.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(note)
        return note

    def set_favorite(self, note_id: Union[str, uuid.UUID], user_id: str, value: bool) -> Optional[Note]:
        """Set favorite explicitly (idempotent), suitable for offline mutation replay."""
        note = self.get_note_by_id(note_id, user_id)
        if not note:
            return None

        note.is_favorite = bool(value)
        note.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(note)
        return note

    def get_notes_by_category(self, user_id: str, category: str) -> List[Note]:
        """按分类获取笔记列表（轻量级，不加载大字段）"""
        return (
            self.db.query(Note)
            .options(load_only(*self.SUMMARY_FIELDS))
            .filter(
                self._ownership_filter(user_id),
                Note.category == category,
                Note.is_archived.is_(False),
            )
            .order_by(Note.created_at.desc())
            .all()
        )

    def search_notes(self, user_id: str, query: str) -> List[Note]:
        """搜索用户笔记（轻量级，不加载大字段）

        改前问题: 使用 f-string 手动拼接通配符 like_expr = f"%{query}%", 存在 SQL 注入风险
        为什么改: 移除手动拼接, 直接在 .ilike() 中使用 f-string, SQLAlchemy 会自动参数化转义
        学习要点:
        - ORM 参数化查询: SQLAlchemy 的 .filter() 和 .ilike() 方法会自动转义参数, 防止 SQL 注入
        - 安全编程原则: 永远不要手动拼接 SQL 字符串, 即使是 f"SELECT * FROM notes WHERE title LIKE '%{query}%'"
        - SQL 注入风险: 攻击者可通过 query="'; DROP TABLE notes;--" 删除数据库表
        - load_only 不影响 filter 条件: 搜索条件可以使用 original_text，但返回结果不包含该字段
        """
        return (
            self.db.query(Note)
            .options(load_only(*self.SUMMARY_FIELDS))
            .filter(
                self._ownership_filter(user_id),
                Note.is_archived.is_(False),
                # SQLAlchemy 会自动转义 query 参数, 防止 SQL 注入
                or_(
                    Note.title.ilike(f"%{query}%"),
                    Note.original_text.ilike(f"%{query}%")
                ),
            )
            .order_by(Note.created_at.desc())
            .all()
        )

    # ── 增量同步 ──────────────────────────────────────────────────────

    def get_notes_updated_since(
        self,
        user_id: str,
        since: datetime,
        *,
        until: Optional[datetime] = None,
        limit: int = 500,
    ) -> List[Note]:
        """获取 since 之后新增或更新的笔记摘要（轻量级）

        用于客户端增量刷新：只拉取服务端新增/更新的笔记。
        """
        query = (
            self.db.query(Note)
            .options(load_only(*self.SUMMARY_FIELDS))
            .filter(
                self._ownership_filter(user_id),
                Note.is_archived.is_(False),
                Note.updated_at > since,
            )
        )
        if until is not None:
            query = query.filter(Note.updated_at <= until)
        return query.order_by(Note.updated_at.asc()).limit(limit).all()

    def get_deleted_note_ids_since(
        self,
        user_id: str,
        since: datetime,
        *,
        until: Optional[datetime] = None,
        limit: int = 500,
    ) -> List[str]:
        """获取 since 之后被删除的笔记 ID 列表

        从 deletion_logs 表查询，配合增量同步使用。
        """
        query = (
            self.db.query(DeletionLog.note_id)
            .filter(
                DeletionLog.user_id == user_id,
                DeletionLog.deleted_at > since,
            )
        )
        if until is not None:
            query = query.filter(DeletionLog.deleted_at <= until)
        rows = query.order_by(DeletionLog.deleted_at.asc()).limit(limit).all()
        return [row[0] for row in rows]

    def get_note_count(self, user_id: str) -> int:
        """获取用户笔记总数（仅统计未归档的）"""
        return (
            self.db.query(Note)
            .filter(
                self._ownership_filter(user_id),
                Note.is_archived.is_(False),
            )
            .count()
        )

    # ── 批量获取详情 ──────────────────────────────────────────────────

    def get_notes_by_ids(
        self, user_id: str, note_ids: List[Union[str, uuid.UUID]]
    ) -> List[Note]:
        """根据 ID 列表批量获取完整笔记详情

        用于客户端后台静默缓存：将未下载的笔记详情批量拉取。
        只返回当前用户有权限访问且未归档的笔记。
        """
        str_ids = [self._normalize_id(nid) for nid in note_ids]
        return (
            self.db.query(Note)
            .filter(
                Note.id.in_(str_ids),
                self._ownership_filter(user_id),
                Note.is_archived.is_(False),
            )
            .all()
        )
