from datetime import timedelta
import uuid

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.database import SessionLocal
from app.main import app
from app.services.note_service import NoteService

client = TestClient(app)


@pytest.mark.security
def test_jwt_token_expiration():
    expired_token = create_access_token(data={"sub": "test_user"}, expires_delta=timedelta(seconds=-10))
    response = client.get("/api/v1/library/notes", headers={"Authorization": f"Bearer {expired_token}"})
    assert response.status_code == 401
    assert response.json().get("detail")


@pytest.mark.security
def test_invalid_token_rejected():
    response = client.get("/api/v1/library/notes", headers={"Authorization": "Bearer invalid-token-12345"})
    assert response.status_code == 401

    response = client.get("/api/v1/library/notes", headers={"Authorization": "Bearer "})
    assert response.status_code == 401

    fake_token = jwt.encode({"sub": "attacker"}, "wrong-secret-key", algorithm="HS256")
    response = client.get("/api/v1/library/notes", headers={"Authorization": f"Bearer {fake_token}"})
    assert response.status_code == 401


@pytest.mark.security
def test_unauthorized_access_denied():
    response = client.get("/api/v1/library/notes")
    assert response.status_code == 401
    assert response.json().get("detail")


@pytest.mark.security
def test_user_cannot_access_other_users_notes():
    suffix = uuid.uuid4().hex[:8]
    user_a = f"auth_sec_user_a_{suffix}"
    user_b = f"auth_sec_user_b_{suffix}"
    pwd_a = "PasswordA123"
    pwd_b = "PasswordB123"

    register_a = client.post(
        "/api/v1/auth/register",
        json={"username": user_a, "password": pwd_a, "email": f"{user_a}@example.com"},
    )
    register_b = client.post(
        "/api/v1/auth/register",
        json={"username": user_b, "password": pwd_b, "email": f"{user_b}@example.com"},
    )
    assert register_a.status_code in (200, 201)
    assert register_b.status_code in (200, 201)

    login_a = client.post("/api/v1/auth/login", json={"username": user_a, "password": pwd_a})
    login_b = client.post("/api/v1/auth/login", json={"username": user_b, "password": pwd_b})
    assert login_a.status_code == 200
    assert login_b.status_code == 200
    token_a = login_a.json()["access_token"]
    token_b = login_b.json()["access_token"]
    user_a_id = register_a.json()["id"]

    with SessionLocal() as session:
        note = NoteService(session).create_note(
            {
                "title": "A private note",
                "original_text": "private text",
                "structured_data": {"summary": "private"},
                "image_urls": [],
                "image_filenames": [],
                "image_sizes": [],
                "category": "private",
                "tags": [],
            },
            user_a_id,
            device_id=user_a_id,
        )
        note_id = str(note.id)

    response_a = client.get(f"/api/v1/library/notes/{note_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert response_a.status_code == 200

    response_b = client.get(f"/api/v1/library/notes/{note_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert response_b.status_code in (403, 404)
