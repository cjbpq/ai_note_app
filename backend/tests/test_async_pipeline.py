import asyncio
import types
import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.upload_job import UploadJob
from app.services import pipeline_runner

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


def test_create_note_from_image_enqueues_background_task(monkeypatch):
    unique_username = f"async-user-{uuid.uuid4()}"
    _, token = _register_and_login(unique_username)
    headers = {"Authorization": f"Bearer {token}"}

    from app.api.v1.endpoints import library

    async def dummy_process(*args, **kwargs):
        dummy_process.called = True

    dummy_process.called = False

    class DummyTask:
        def __init__(self, coro):
            self.coro = coro

        def cancel(self) -> None:
            pass

    def fake_create_task(coro):
        fake_create_task.coro = coro
        coro.close()
        return DummyTask(coro)

    fake_create_task.coro = None

    monkeypatch.setattr(library, "process_note_job", dummy_process)
    monkeypatch.setattr(library.asyncio, "create_task", fake_create_task)
    monkeypatch.setattr(
        library,
        "doubao_service",
        types.SimpleNamespace(is_available=True, availability_status=lambda: (True, None)),
    )

    with open("test_upload.png", "rb") as f:
        response = client.post(
            "/api/v1/library/notes/from-image",
            headers=headers,
            files={"file": ("test_upload.png", f, "image/png")},
            data={"note_type": "study note", "tags": "demo,test"},
        )

    assert response.status_code == 202
    payload = response.json()
    assert payload["status"] == "ENQUEUED"
    assert payload["job_id"]
    assert dummy_process.called is False
    assert fake_create_task.coro is not None

    with SessionLocal() as session:
        job = session.query(UploadJob).filter(UploadJob.id == payload["job_id"]).first()
        assert job is not None
        assert job.status == "QUEUED"


def test_job_progress_stream(monkeypatch):
    unique_username = f"stream-user-{uuid.uuid4()}"
    user_id, token = _register_and_login(unique_username)
    headers = {"Authorization": f"Bearer {token}"}

    job_id = str(uuid.uuid4())
    with SessionLocal() as session:
        job = UploadJob(
            id=job_id,
            user_id=user_id,
            device_id=user_id,
            source="test",
            status="PERSISTED",
            file_meta={
                "original_name": "test.png",
                "extension": ".png",
                "size": 123,
                "content_type": "image/png",
                "checksum": "abc",
            },
            storage={
                "location": "local",
                "path": "uploaded_images/test.png",
                "url": "/static/test.png",
            },
        )
        session.add(job)
        session.commit()

    from app.api.v1.endpoints import upload

    async def fast_sleep(_: float) -> None:
        return None

    monkeypatch.setattr(upload.asyncio, "sleep", fast_sleep)

    with client.stream(
        "GET",
        f"/api/v1/upload/jobs/{job_id}/stream",
        headers=headers,
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    assert "data:" in body
    assert job_id in body


def test_process_note_job_with_doubao(monkeypatch):
    unique_username = f"doubao-user-{uuid.uuid4()}"
    user_id, _ = _register_and_login(unique_username)

    job_id = str(uuid.uuid4())
    with SessionLocal() as session:
        job = UploadJob(
            id=job_id,
            user_id=user_id,
            device_id=user_id,
            source="test",
            status="STORED",
            file_meta={
                "original_name": "fake.png",
                "extension": ".png",
                "size": 123,
                "content_type": "image/png",
            },
            storage={
                "location": "local",
                "path": "fake-path",
                "url": "/static/fake.png",
            },
        )
        session.add(job)
        session.commit()

    fake_note_payload = {
        "title": "Sample Note",
        "summary": "Summary",
        "raw_text": "Raw text",
        "sections": [{"heading": "Section", "content": "Content"}],
        "key_points": ["Point"],
        "study_advice": "Advice",
    }

    monkeypatch.setattr(pipeline_runner.settings, "USE_DOUBAO_PIPELINE", True)

    class DummyDoubao:
        is_available = True

        @staticmethod
        def generate_structured_note(
            image_paths,
            *,
            note_type,
            tags,
            detail=None,
            max_completion_tokens=None,
            thinking=None,
        ):
            assert image_paths == ["fake-path"]
            return {
                "note": fake_note_payload,
                "raw_text": "Raw text",
                "response": {"id": "resp-1", "usage": {"input_tokens": 10, "output_tokens": 20}},
            }

        @staticmethod
        def availability_status():
            return True, None

    monkeypatch.setattr(pipeline_runner, "doubao_service", DummyDoubao(), raising=False)

    asyncio.run(
        pipeline_runner.process_note_job(
            job_id,
            user_id=user_id,
            device_id=user_id,
            note_type="study note",
            tags=["test"],
        )
    )

    with SessionLocal() as session:
        job = session.query(UploadJob).filter(UploadJob.id == job_id).first()
        assert job is not None
        assert job.status == "PERSISTED"
        assert job.ai_result.get("title") == "Sample Note"
        assert job.ocr_result["provider"] == "doubao"

        note = job.note
        assert note is not None
        assert note.title == "Sample Note"
        assert note.structured_data.get("meta", {}).get("provider") == "doubao"


def test_process_note_job_without_doubao_fails(monkeypatch):
    unique_username = f"doubao-fail-user-{uuid.uuid4()}"
    user_id, _ = _register_and_login(unique_username)

    job_id = str(uuid.uuid4())
    with SessionLocal() as session:
        job = UploadJob(
            id=job_id,
            user_id=user_id,
            device_id=user_id,
            source="test",
            status="STORED",
            file_meta={
                "original_name": "fake.png",
                "extension": ".png",
                "size": 123,
                "content_type": "image/png",
            },
            storage={
                "location": "local",
                "path": "fake-path",
                "url": "/static/fake.png",
            },
        )
        session.add(job)
        session.commit()

    monkeypatch.setattr(pipeline_runner.settings, "USE_DOUBAO_PIPELINE", True)
    monkeypatch.setattr(pipeline_runner.settings, "DOUBAO_ALLOW_LEGACY_FALLBACK", False)

    class FailingDoubao:
        is_available = False

        @staticmethod
        def generate_structured_note(
            image_paths,
            *,
            note_type,
            tags,
            detail=None,
            max_completion_tokens=None,
            thinking=None,
        ):
            raise pipeline_runner.DoubaoServiceError("missing doubao client")

        @staticmethod
        def availability_status():
            return False, "Doubao SDK not installed"

    monkeypatch.setattr(pipeline_runner, "doubao_service", FailingDoubao(), raising=False)

    asyncio.run(
        pipeline_runner.process_note_job(
            job_id,
            user_id=user_id,
            device_id=user_id,
            note_type="study note",
            tags=["test"],
        )
    )

    with SessionLocal() as session:
        job = session.query(UploadJob).filter(UploadJob.id == job_id).first()
        assert job is not None
        assert job.status == "FAILED"
        assert job.error_logs, "Expected Doubao failure reason to be logged"
        assert job.error_logs[-1]["stage"] == "DOUBAO"
