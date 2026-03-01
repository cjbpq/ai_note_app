import uuid

from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models.email_verification_code import EmailVerificationCode
from app.models.note import Note
from app.models.user import User
from app.services.note_service import NoteService

client = TestClient(app)

# Ensure schema stays in sync with ORM models for this module.
if engine.dialect.name == "sqlite":
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


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


def _get_latest_email_code(email: str, purpose: str) -> str:
    with SessionLocal() as session:
        record = (
            session.query(EmailVerificationCode)
            .filter(
                EmailVerificationCode.email == email,
                EmailVerificationCode.purpose == purpose,
            )
            .order_by(EmailVerificationCode.created_at.desc())
            .first()
        )
        assert record is not None
        return record.code


def test_delete_user_removes_account_and_notes():
    unique_username = f"user-{uuid.uuid4()}"
    user_id, token = _register_and_login(unique_username)

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

    with SessionLocal() as session:
        note = session.query(Note).filter(Note.user_id == user_id).first()
        assert note is None
        user_record = session.query(User).filter(User.id == user_id).first()
        assert user_record is None


def test_change_password_requires_correct_old_password():
    username = f"change-pwd-{uuid.uuid4().hex[:10]}"
    old_password = "OldPassword123"
    new_password = "NewPassword456"
    _, token = _register_and_login(username, old_password)

    headers = {"Authorization": f"Bearer {token}"}

    bad_resp = client.post(
        "/api/v1/auth/password/change",
        json={"old_password": "WrongPassword", "new_password": new_password},
        headers=headers,
    )
    assert bad_resp.status_code == 400

    good_resp = client.post(
        "/api/v1/auth/password/change",
        json={"old_password": old_password, "new_password": new_password},
        headers=headers,
    )
    assert good_resp.status_code == 200
    assert good_resp.json().get("message") == "密码修改成功"

    old_login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": old_password},
    )
    assert old_login_resp.status_code == 401

    new_login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": new_password},
    )
    assert new_login_resp.status_code == 200


def test_reset_password_by_email_verification_code(monkeypatch):
    username = f"reset-pwd-{uuid.uuid4().hex[:10]}"
    old_password = "OldPassword123"
    new_password = "NewPassword456"
    email = f"{username}@example.com"
    _register_and_login(username, old_password)

    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.email_service.send_verification_code",
        lambda *_args, **_kwargs: True,
    )

    send_resp = client.post(
        "/api/v1/auth/email/send-code",
        json={"email": email, "purpose": "reset_password"},
    )
    assert send_resp.status_code == 200

    code = _get_latest_email_code(email, "reset_password")
    reset_resp = client.post(
        "/api/v1/auth/password/reset",
        json={"email": email, "code": code, "new_password": new_password},
    )
    assert reset_resp.status_code == 200
    assert reset_resp.json().get("message") == "密码已重置"

    old_login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": old_password},
    )
    assert old_login_resp.status_code == 401

    new_login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": new_password},
    )
    assert new_login_resp.status_code == 200


def test_change_bound_email_by_verification_code(monkeypatch):
    username = f"change-email-{uuid.uuid4().hex[:10]}"
    password = "ChangeEmail123"
    old_email = f"{username}@example.com"
    new_email = f"new-{uuid.uuid4().hex[:10]}@example.com"
    _, token = _register_and_login(username, password)

    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.email_service.send_verification_code",
        lambda *_args, **_kwargs: True,
    )

    send_resp = client.post(
        "/api/v1/auth/email/send-code",
        json={"email": new_email, "purpose": "change_email"},
    )
    assert send_resp.status_code == 200

    code = _get_latest_email_code(new_email, "change_email")
    headers = {"Authorization": f"Bearer {token}"}
    change_resp = client.post(
        "/api/v1/auth/email/change",
        json={"new_email": new_email, "code": code},
        headers=headers,
    )
    assert change_resp.status_code == 200
    assert change_resp.json().get("email") == new_email

    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json().get("email") == new_email
    assert me_resp.json().get("email") != old_email
