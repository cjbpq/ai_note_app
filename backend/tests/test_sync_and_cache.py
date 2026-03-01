"""增量同步 & 批量缓存 API 测试

覆盖范围:
- GET  /api/v1/library/notes/sync  — 增量同步（with/without since, 删除同步）
- POST /api/v1/library/notes/batch — 批量获取笔记详情
- 删除笔记后 DeletionLog 是否正确写入
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.orm import Session

from app.models.note import Note
from app.models.deletion_log import DeletionLog
from app.services.note_service import NoteService


# ========================================
# NoteService 单元测试
# ========================================


@pytest.mark.unit
class TestNoteServiceSync:
    """NoteService 增量同步相关方法测试"""

    def _create_note(self, db: Session, user_id: str, **overrides) -> Note:
        """快捷创建笔记"""
        defaults = dict(
            id=str(uuid.uuid4()),
            user_id=user_id,
            device_id=user_id,
            title="测试笔记",
            category="学习笔记",
            tags=["测试"],
            image_urls=["/static/test.png"],
            image_filenames=["test.png"],
            image_sizes=[1024],
            original_text="这是测试内容",
            structured_data={"summary": "测试摘要"},
            is_favorite=False,
            is_archived=False,
        )
        defaults.update(overrides)
        note = Note(**defaults)
        db.add(note)
        db.commit()
        db.refresh(note)
        return note

    def test_get_notes_updated_since_returns_new_notes(self, db_session, test_user):
        """since 之后创建的笔记应被返回"""
        svc = NoteService(db_session)
        past = datetime.now(timezone.utc) - timedelta(hours=1)

        n1 = self._create_note(db_session, test_user.id, title="新笔记1")
        n2 = self._create_note(db_session, test_user.id, title="新笔记2")

        results = svc.get_notes_updated_since(test_user.id, past)
        ids = {r.id for r in results}
        assert n1.id in ids
        assert n2.id in ids

    def test_get_notes_updated_since_excludes_old(self, db_session, test_user):
        """since 之前的笔记不应被返回（通过将 since 设为未来时间模拟）"""
        svc = NoteService(db_session)
        future = datetime.now(timezone.utc) + timedelta(hours=1)

        self._create_note(db_session, test_user.id, title="旧笔记")

        results = svc.get_notes_updated_since(test_user.id, future)
        assert len(results) == 0

    def test_get_notes_updated_since_respects_until(self, db_session, test_user):
        """增量查询应遵循 until 上界（用于避免同步窗口漏/重）"""
        svc = NoteService(db_session)
        since = datetime.now(timezone.utc) - timedelta(hours=1)

        note = self._create_note(db_session, test_user.id, title="窗口测试")

        # 将 until 设置到 created_at 之前，确保该笔记不会被返回
        until = note.created_at - timedelta(seconds=1)
        results = svc.get_notes_updated_since(test_user.id, since, until=until)
        assert all(item.id != note.id for item in results)

    def test_delete_note_creates_deletion_log(self, db_session, test_user):
        """删除笔记时应写入 DeletionLog"""
        svc = NoteService(db_session)
        note = self._create_note(db_session, test_user.id, title="待删除")
        note_id = note.id

        result = svc.delete_note(note_id, test_user.id)
        assert result is True

        # 验证 DeletionLog 已写入
        log = (
            db_session.query(DeletionLog)
            .filter(DeletionLog.note_id == note_id)
            .first()
        )
        assert log is not None
        assert log.user_id == test_user.id

    def test_get_deleted_note_ids_since(self, db_session, test_user):
        """增量同步应返回 since 之后删除的笔记 ID"""
        svc = NoteService(db_session)
        past = datetime.now(timezone.utc) - timedelta(hours=1)

        note = self._create_note(db_session, test_user.id, title="即将删除")
        note_id = note.id
        svc.delete_note(note_id, test_user.id)

        deleted_ids = svc.get_deleted_note_ids_since(test_user.id, past)
        assert note_id in deleted_ids

    def test_get_notes_by_ids_batch(self, db_session, test_user):
        """批量获取应返回完整笔记（含 original_text & structured_data）"""
        svc = NoteService(db_session)

        n1 = self._create_note(db_session, test_user.id, title="批量1")
        n2 = self._create_note(db_session, test_user.id, title="批量2")
        n3 = self._create_note(db_session, test_user.id, title="批量3")

        results = svc.get_notes_by_ids(test_user.id, [n1.id, n3.id])
        ids = {r.id for r in results}
        assert n1.id in ids
        assert n3.id in ids
        assert n2.id not in ids

        # 确认返回完整字段
        for note in results:
            assert note.original_text is not None
            assert note.structured_data is not None

    def test_get_notes_by_ids_ignores_other_user(self, db_session, test_user):
        """批量获取不应返回其他用户的笔记"""
        svc = NoteService(db_session)

        other_note = self._create_note(
            db_session, "other-user-id", title="其他人的笔记", device_id="other-user-id"
        )

        results = svc.get_notes_by_ids(test_user.id, [other_note.id])
        assert len(results) == 0

    def test_get_note_count(self, db_session, test_user):
        """笔记计数应正确"""
        svc = NoteService(db_session)

        self._create_note(db_session, test_user.id, title="笔记A")
        self._create_note(db_session, test_user.id, title="笔记B")
        self._create_note(db_session, test_user.id, title="已归档", is_archived=True)

        count = svc.get_note_count(test_user.id)
        assert count == 2  # 不含已归档


# ========================================
# API 端点集成测试
# ========================================


@pytest.mark.integration
class TestSyncEndpoint:
    """GET /api/v1/library/notes/sync 集成测试"""

    def test_sync_requires_auth(self, test_client):
        """未认证应返回 401"""
        resp = test_client.get("/api/v1/library/notes/sync")
        assert resp.status_code == 401

    def test_sync_without_since_returns_all(self, test_client, auth_token):
        """不传 since 应返回全量摘要"""
        resp = test_client.get(
            "/api/v1/library/notes/sync",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "updated" in data
        assert "deleted_ids" in data
        assert "server_time" in data

    def test_sync_with_since(self, test_client, auth_token):
        """传 since 应正常返回"""
        since = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        resp = test_client.get(
            "/api/v1/library/notes/sync",
            params={"since": since},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["updated"], list)
        assert isinstance(data["deleted_ids"], list)


@pytest.mark.integration
class TestBatchEndpoint:
    """POST /api/v1/library/notes/batch 集成测试"""

    def test_batch_requires_auth(self, test_client):
        """未认证应返回 401"""
        resp = test_client.post(
            "/api/v1/library/notes/batch",
            json={"note_ids": [str(uuid.uuid4())]},
        )
        assert resp.status_code == 401

    def test_batch_empty_list_rejected(self, test_client, auth_token):
        """空列表应被拒绝（min_length=1）"""
        resp = test_client.post(
            "/api/v1/library/notes/batch",
            json={"note_ids": []},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 422

    def test_batch_nonexistent_ids_returns_empty(self, test_client, auth_token):
        """不存在的 ID 应返回空列表"""
        resp = test_client.post(
            "/api/v1/library/notes/batch",
            json={"note_ids": [str(uuid.uuid4())]},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["notes"] == []
        assert data["total"] == 0


@pytest.mark.integration
class TestNotesFavoriteFilterCompatibility:
    """GET /api/v1/library/notes 收藏参数兼容测试"""

    def test_list_notes_supports_is_favorite_param(self, test_client, auth_token):
        """应兼容 is_favorite=true 参数（与前端约定一致）"""
        resp = test_client.get(
            "/api/v1/library/notes",
            params={"is_favorite": "true"},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "notes" in data
        assert "total" in data
