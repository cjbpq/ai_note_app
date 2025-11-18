from typing import Dict, Any, List, Optional, Union
import uuid
import logging

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.note import Note
from app.core.exceptions import NoteNotFoundError

logger = logging.getLogger(__name__)


class NoteService:
    """笔记相关业务逻辑"""

    def __init__(self, db: Session):
        self.db = db

    def create_note(self, note_data: Dict[str, Any], user_id: str, *, device_id: Optional[str] = None) -> Note:
        """创建笔记

        学习要点:
        - 在关键业务操作中添加日志记录
        - logger.info 用于记录正常业务操作 (如笔记创建)
        - extra 参数提供结构化日志上下文 (user_id, category 等)
        """
        logger.info(f"创建笔记: user_id={user_id}, category={note_data.get('category')}")
        note = Note(user_id=user_id, device_id=device_id or user_id, **note_data)
        self.db.add(note)
        self.db.commit()
        self.db.refresh(note)
        logger.debug(f"笔记已创建: note_id={note.id}")
        return note

    def _ownership_filter(self, user_id: str):
        return or_(Note.user_id == user_id, and_(Note.user_id.is_(None), Note.device_id == user_id))

    def get_user_notes(self, user_id: str, skip: int = 0, limit: int = 100) -> List[Note]:
        return (
            self.db.query(Note)
            .filter(self._ownership_filter(user_id), Note.is_archived.is_(False))
            .order_by(Note.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def _normalize_id(self, note_id: Union[str, uuid.UUID]) -> str:
        return str(note_id)

    def get_note_by_id(self, note_id: Union[str, uuid.UUID], user_id: str) -> Optional[Note]:
        return (
            self.db.query(Note)
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

        self.db.commit()
        self.db.refresh(note)
        return note

    def delete_note(self, note_id: Union[str, uuid.UUID], user_id: str) -> bool:
        """删除笔记

        学习要点:
        - 敏感操作使用 logger.warning 级别记录
        - 记录关键信息 (note_id, user_id, title) 便于审计
        """
        note = self.get_note_by_id(note_id, user_id)
        if not note:
            return False

        logger.warning(f"笔记删除: note_id={note_id}, user_id={user_id}, title={note.title}")
        self.db.delete(note)
        self.db.commit()
        return True

    def toggle_favorite(self, note_id: Union[str, uuid.UUID], user_id: str) -> Optional[Note]:
        note = self.get_note_by_id(note_id, user_id)
        if not note:
            return None

        note.is_favorite = not note.is_favorite
        self.db.commit()
        self.db.refresh(note)
        return note

    def get_notes_by_category(self, user_id: str, category: str) -> List[Note]:
        return (
            self.db.query(Note)
            .filter(
                self._ownership_filter(user_id),
                Note.category == category,
                Note.is_archived.is_(False),
            )
            .order_by(Note.created_at.desc())
            .all()
        )

    def search_notes(self, user_id: str, query: str) -> List[Note]:
        """���索用户笔记

        改前问题: 使用 f-string 手动拼接通配符 like_expr = f"%{query}%", 存在 SQL 注入风险
        为什么改: 移除手动拼接, 直接在 .ilike() 中使用 f-string, SQLAlchemy 会自动参数化转义
        学习要点:
        - ORM 参数化查询: SQLAlchemy 的 .filter() 和 .ilike() 方法会自动转义参数, 防止 SQL 注入
        - 安全编程原则: 永远不要手动拼接 SQL 字符串, 即使是 f"SELECT * FROM notes WHERE title LIKE '%{query}%'"
        - SQL 注入风险: 攻击者可通过 query="'; DROP TABLE notes;--" 删除数据库表
        """
        return (
            self.db.query(Note)
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
