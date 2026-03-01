import uuid

import pytest

from app.database import SessionLocal
from app.models.deletion_log import DeletionLog
from app.models.note import Note
from app.services.note_service import NoteService


def _register_and_login(test_client):
    username = f"offline_{uuid.uuid4().hex[:8]}"
    password = "TestPassword123"
    email = f"{username}@example.com"

    register_resp = test_client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": password, "email": email},
    )
    assert register_resp.status_code in (200, 201)

    login_resp = test_client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]

    me_resp = test_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    user_id = me_resp.json()["id"]
    return user_id, token


def _create_note_for_user(user_id: str, *, title: str) -> str:
    note_data = {
        "title": title,
        "category": "学习笔记",
        "tags": ["offline"],
        "image_urls": ["/static/test.png"],
        "image_filenames": ["test.png"],
        "image_sizes": [128],
        "original_text": "offline note content",
        "structured_data": {"summary": "offline summary"},
    }
    with SessionLocal() as session:
        note = NoteService(session).create_note(note_data, user_id, device_id=user_id)
        return note.id


@pytest.mark.integration
class TestOfflineMutationsEndpoint:
    def test_mutations_requires_auth(self, test_client):
        response = test_client.post("/api/v1/library/notes/mutations", json={"mutations": []})
        assert response.status_code == 401

    def test_mutations_apply_update_favorite_delete(self, test_client):
        user_id, token = _register_and_login(test_client)
        note_update_id = _create_note_for_user(user_id, title="offline-update")
        note_favorite_id = _create_note_for_user(user_id, title="offline-favorite")
        note_delete_id = _create_note_for_user(user_id, title="offline-delete")

        payload = {
            "mutations": [
                {
                    "op_id": "op-update-1",
                    "type": "update_note",
                    "note_id": note_update_id,
                    "patch": {"title": "offline-updated-title", "category": "离线编辑"},
                },
                {
                    "op_id": "op-favorite-1",
                    "type": "set_favorite",
                    "note_id": note_favorite_id,
                    "is_favorite": True,
                },
                {
                    "op_id": "op-delete-1",
                    "type": "delete_note",
                    "note_id": note_delete_id,
                },
            ]
        }

        response = test_client.post(
            "/api/v1/library/notes/mutations",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()

        assert body["applied_count"] == 3
        assert body["failed_count"] == 0
        assert len(body["results"]) == 3
        assert all(item["status"] == "applied" for item in body["results"])

        with SessionLocal() as session:
            updated_note = session.query(Note).filter(Note.id == note_update_id).first()
            favorited_note = session.query(Note).filter(Note.id == note_favorite_id).first()
            deleted_note = session.query(Note).filter(Note.id == note_delete_id).first()
            deletion_log = session.query(DeletionLog).filter(DeletionLog.note_id == note_delete_id).first()

            assert updated_note is not None
            assert updated_note.title == "offline-updated-title"
            assert updated_note.category == "离线编辑"

            assert favorited_note is not None
            assert favorited_note.is_favorite is True

            assert deleted_note is None
            assert deletion_log is not None
            assert deletion_log.user_id == user_id

    def test_mutations_partial_failures_reported(self, test_client):
        user_id, token = _register_and_login(test_client)
        note_id = _create_note_for_user(user_id, title="offline-invalid")

        payload = {
            "mutations": [
                {
                    "op_id": "op-invalid-update",
                    "type": "update_note",
                    "note_id": note_id,
                },
                {
                    "op_id": "op-invalid-favorite",
                    "type": "set_favorite",
                    "note_id": note_id,
                },
                {
                    "op_id": "op-missing-note",
                    "type": "delete_note",
                    "note_id": str(uuid.uuid4()),
                },
            ]
        }

        response = test_client.post(
            "/api/v1/library/notes/mutations",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()

        assert body["applied_count"] == 0
        assert body["failed_count"] == 3

        results = {item["op_id"]: item for item in body["results"]}

        assert results["op-invalid-update"]["status"] == "invalid"
        assert results["op-invalid-update"]["code"] == 422

        assert results["op-invalid-favorite"]["status"] == "invalid"
        assert results["op-invalid-favorite"]["code"] == 422

        assert results["op-missing-note"]["status"] == "not_found"
        assert results["op-missing-note"]["code"] == 404
