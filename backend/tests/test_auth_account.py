import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.services.note_service import NoteService
from app.models.note import Note
from app.models.user import User


client = TestClient(app)


def _register_and_login(username: str, password: str = "pass1234"):
    register_payload = {
        "username": username,
        "password": password,
        "email": f"{username}@example.com",
    }
    resp = client.post("/api/v1/auth/register", json=register_payload)
    assert resp.status_code == 201
    user_data = resp.json()

    login_payload = {"username": username, "password": password}
    login_resp = client.post("/api/v1/auth/login", json=login_payload)
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    return user_data["id"], token


def test_delete_user_removes_account_and_notes():
    unique_username = f"user-{uuid.uuid4()}"
    user_id, token = _register_and_login(unique_username)

    # Seed a note for the user to ensure cascading clean up
    with SessionLocal() as session:
        note_service = NoteService(session)
        note_service.create_note(
            {
                "title": "测试笔记",
                "original_text": "内容",
                "structured_data": {"sections": [], "summary": "内容"},
                "image_url": "/static/test.png",
                "image_filename": "test.png",
                "image_size": 123,
                "category": "学习笔记",
                "tags": [],
            },
            user_id,
            device_id=user_id,
        )

    headers = {"Authorization": f"Bearer {token}"}
    delete_resp = client.delete("/api/v1/auth/me", headers=headers)
    assert delete_resp.status_code == 200
    assert delete_resp.json().get("message") == "用户已注销"

    # Verify user removed
    with SessionLocal() as session:
        note = session.query(Note).filter(Note.user_id == user_id).first()
        assert note is None
        user_record = session.query(User).filter(User.id == user_id).first()
        assert user_record is None