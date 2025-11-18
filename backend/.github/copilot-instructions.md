```instructions
# AI Agent Guide for AI Note Backend

## 🧭 Architecture snapshot (quick)
- FastAPI app boots in `app/main.py` — patches stdin for Windows, mounts `/static` to `uploaded_images/`, and ensures SQLite schema via `ensure_sqlite_schema()`.
- Routers are registered through `app/api/v1/api.py::_safe_include(...)` — use this helper to avoid import-time side effects.
- DB: `app/database.py` exposes `SessionLocal` and `get_db`. Request handlers use `Depends(get_db)`; background tasks must manually open/close `SessionLocal()`.

## 📸 Upload → AI note pipeline (core flow)
- Uploads validated in `InputPipelineService.create_job` (checks `ALLOWED_EXTENSIONS`, size cap ≈10MB) and stored via `LocalStorageBackend` (writes `uploaded_images/` and returns `/static/...` URLs).
- `POST /api/v1/library/notes/from-image` (see `app/api/v1/endpoints/library.py`) marks job `QUEUED` then calls `asyncio.create_task(process_note_job(...))` so requests return quickly.
- `process_note_job` (`app/services/pipeline_runner.py`) reopens a DB session, checks `doubao_service.availability_status()`, runs `generate_structured_note` in a worker thread, calls `clean_ocr_text`, persists with `NoteService.create_note`, and advances statuses: RECEIVED → STORED → QUEUED → AI_PENDING → AI_DONE → PERSISTED.
- Failure handling: always call `UploadJob.append_error(stage, error)` and commit; `_update_status` bumps `updated_at` (SSE relies on it).

## 🔧 Key files you'll edit most
- `app/main.py` — app startup, static-mounts, schema patches.
- `app/database.py` — engine, SessionLocal, `get_db`.
- `app/services/pipeline_runner.py` — background job orchestration and status transitions.
- `app/api/v1/endpoints/library.py` — upload endpoints and enqueue logic.
- `app/services/prompt_profiles.py` + `app/prompts/profiles.json` — prompt profile manager (hot-reloads, merging schema fragments).
- `app/database/models/*.py` and `app/schemas/*.py` — canonical models and DTOs (UploadJob, Note, PromptProfileVersion).

## Project-specific conventions (do this, not that)
- Use `NoteService` (or its `_ownership_filter`) for note queries — device-owned notes are `user_id IS NULL AND device_id == device`. Avoid ad-hoc filters.
- For prompt logic, always use `prompt_profile_manager` helpers (caching + versioning) instead of reading `profiles.json` directly.
- Storage backends must implement `StorageBackend.store_bytes`. The `LocalStorageBackend` writes to `uploaded_images/` and returns `/static/` URLs — mimic that for S3/minio.
- Background tasks must open a fresh `SessionLocal()` (do not reuse request-scoped sessions).
- To surface pipeline errors to clients, append errors and commit so SSE endpoints (`/api/v1/upload/jobs/{job_id}/stream`) detect `updated_at` changes.

## External integrations & credentials
- Doubao (Volcengine) SDK required for AI steps. Install: `pip install "volcengine-python-sdk[ark]"` and set `DOUBAO_API_KEY` or AK/SK env vars. Without them `doubao_service.availability_status()` will fail and AI pipeline raises HTTP 500.

## Tests & debugging quick-cues
- Activate env: run `activate_env.bat`. Start dev server: `start.bat` (runs `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`).
- Run tests: `pytest tests/` or a single file (e.g. `pytest tests/test_async_pipeline.py`).
- `debug_request.py` is an end-to-end TestClient example; use it to reproduce API flows locally.
- Long-running scripts (`seed_note.py`, `inspect_notes.py`) show the correct pattern for manual `SessionLocal()` usage.

## Small examples
- To add a new router: open `app/api/v1/api.py` and call `_safe_include(router_module.router)`; avoid direct `app.include_router` in new modules.
- To persist a pipeline job status update correctly: reopen a fresh `SessionLocal()`, call `job.append_error(...)` or `_update_status(...)`, then `session.commit()` so SSE streams pick up changes.

## When to ask for human help / Known pain points
- Missing Doubao credentials for live pipeline testing — ask maintainers or use test mocks.
- If migrations fail, `app.db.before_alembic` is present for reference; prefer `alembic` for schema changes.

---

Please review and tell me if you want more CI steps, credential examples, or extra code snippets added.
```
