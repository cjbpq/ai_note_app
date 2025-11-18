import types
import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _register_and_login(username: str, password: str = "pass1234") -> tuple[str, str]:
    register_payload = {
        "username": username,
        "password": password,
        "email": f"{username}@example.com",
    }
    resp = client.post("/api/v1/auth/register", json=register_payload)
    assert resp.status_code == 201
    user_id = resp.json()["id"]

    login_payload = {"username": username, "password": password}
    login_resp = client.post("/api/v1/auth/login", json=login_payload)
    assert login_resp.status_code == 200
    return user_id, login_resp.json()["access_token"]


def test_extract_text_from_image(monkeypatch):
    unique_username = f"text-user-{uuid.uuid4()}"
    _, token = _register_and_login(unique_username)
    headers = {"Authorization": f"Bearer {token}"}

    from app.api.v1.endpoints import library

    dummy_response = {
        "text": "# 标题\n- 项目一",
        "response": {"id": "resp-123"},
        "format": "markdown",
    }

    dummy_service = types.SimpleNamespace(
        availability_status=lambda: (True, None),
        generate_plain_text=lambda *args, **kwargs: dummy_response,
    )

    monkeypatch.setattr(library, "doubao_service", dummy_service)

    with open("test_upload.png", "rb") as f:
        response = client.post(
            "/api/v1/library/text/from-image",
            headers=headers,
            files={"file": ("test_upload.png", f, "image/png")},
            data={"output_format": "markdown"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["text"] == dummy_response["text"]
    assert payload["format"] == "markdown"
    assert payload["provider"] == "doubao"
    assert payload["response"] == dummy_response["response"]
    assert payload["file_url"].startswith("/static/")
