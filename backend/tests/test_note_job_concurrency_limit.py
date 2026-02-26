import types
import uuid

from fastapi.testclient import TestClient

from app.core import dependencies
from app.database import SessionLocal
from app.main import app
from app.models.upload_job import UploadJob
from app.services.input_pipeline_service import MAX_CONCURRENT_NOTE_JOBS_PER_USER

client = TestClient(app)


def _register_and_login(username: str, password: str = "pass1234") -> tuple[str, str]:
    register_payload = {
        "username": username,
        "password": password,
        "email": f"{username}@example.com",
    }
    register_resp = client.post("/api/v1/auth/register", json=register_payload)
    assert register_resp.status_code == 201
    user_id = register_resp.json()["id"]

    login_resp = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert login_resp.status_code == 200
    return user_id, login_resp.json()["access_token"]


def _seed_active_jobs(user_id: str, count: int) -> None:
    with SessionLocal() as session:
        for _ in range(count):
            session.add(
                UploadJob(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    device_id=user_id,
                    source="library_from_image",
                    status="QUEUED",
                    file_meta={"files": [], "total_size": 0},
                    storage=[],
                )
            )
        session.commit()


def test_create_note_from_image_rejects_when_active_jobs_reach_limit(monkeypatch):
    monkeypatch.setattr(
        dependencies,
        "doubao_service",
        types.SimpleNamespace(availability_status=lambda: (True, None)),
    )

    from app.api.v1.endpoints import library

    async def dummy_process(*args, **kwargs):
        return None

    monkeypatch.setattr(library, "process_note_job", dummy_process)

    unique_username = f"limit-user-{uuid.uuid4()}"
    user_id, token = _register_and_login(unique_username)
    _seed_active_jobs(user_id, MAX_CONCURRENT_NOTE_JOBS_PER_USER)

    response = client.post(
        "/api/v1/library/notes/from-image",
        headers={"Authorization": f"Bearer {token}"},
        files=[("files", ("limit.png", b"fakepngbytes", "image/png"))],
        data={"note_type": "study note"},
    )

    assert response.status_code == 429
    assert str(MAX_CONCURRENT_NOTE_JOBS_PER_USER) in response.json()["detail"]
