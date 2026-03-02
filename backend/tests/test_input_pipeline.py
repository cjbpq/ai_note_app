import hashlib
import io

from fastapi import HTTPException
from starlette.datastructures import Headers, UploadFile

from app.database import SessionLocal
from app.models.upload_job import UploadJob
from app.services.input_pipeline_service import InputPipelineService
from app.services.storage_backends.local import LocalStorageBackend


def _make_upload_file(content: bytes, filename: str = "sample.png", content_type: str = "image/png") -> UploadFile:
    return UploadFile(
        filename=filename,
        file=io.BytesIO(content),
        headers=Headers({"content-type": content_type}),
    )


def test_create_job_persists_metadata(tmp_path):
    payload = b"fake-image-bytes"
    upload = _make_upload_file(payload)

    backend = LocalStorageBackend(base_dir=tmp_path)

    with SessionLocal() as session:
        service = InputPipelineService(session, backend)
        job, storage = service.create_job(upload, user_id="user-1", device_id="device-1", source="test")

        assert job.status == "STORED"
        assert job.file_meta["size"] == len(payload)
        assert job.file_meta["checksum"] == hashlib.sha256(payload).hexdigest()
        assert storage.url.endswith(f"{job.id}.png")

        stored_path = tmp_path / f"{job.id}.png"
        assert stored_path.exists()

        # Cleanup
        session.delete(job)
        session.commit()


def test_create_job_rejects_invalid_extension(tmp_path):
    payload = b"not-an-image"
    upload = _make_upload_file(payload, filename="sample.txt", content_type="text/plain")

    backend = LocalStorageBackend(base_dir=tmp_path)

    with SessionLocal() as session:
        service = InputPipelineService(session, backend)
        try:
            service.create_job(upload, user_id="user-1", device_id="device-1")
        except HTTPException as exc:
            assert exc.status_code == 400
        else:
            raise AssertionError("Expected HTTPException for invalid file extension")

        session.query(UploadJob).delete()
        session.commit()


def test_create_job_accepts_blob_filename_with_image_content_type(tmp_path):
    payload = b"fake-image-bytes"
    upload = _make_upload_file(payload, filename="blob", content_type="image/png")

    backend = LocalStorageBackend(base_dir=tmp_path)

    with SessionLocal() as session:
        service = InputPipelineService(session, backend)
        job, storage = service.create_job(upload, user_id="user-1", device_id="device-1")

        assert job.status == "STORED"
        assert job.file_meta["extension"] == ".png"
        assert job.file_meta["original_name"] == "blob.png"
        assert storage.url.endswith(".png")

        session.delete(job)
        session.commit()


def test_create_job_accepts_webp_extension(tmp_path):
    payload = b"fake-image-bytes"
    upload = _make_upload_file(payload, filename="sample.webp", content_type="image/webp")

    backend = LocalStorageBackend(base_dir=tmp_path)

    with SessionLocal() as session:
        service = InputPipelineService(session, backend)
        job, storage = service.create_job(upload, user_id="user-1", device_id="device-1")

        assert job.status == "STORED"
        assert job.file_meta["extension"] == ".webp"
        assert storage.url.endswith(".webp")

        session.delete(job)
        session.commit()
