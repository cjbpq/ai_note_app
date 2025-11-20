```instructions
# AI Agent Guide for AI Note Backend

## 🧭 Architecture Snapshot
- **Entry Point**: `app/main.py` uses `lifespan` for startup (DB schema, logging).
- **Routing**: `app/api/v1/api.py` uses `_safe_include(...)` to register routers (e.g., `/library`, `/notes`). Use this helper to prevent import errors from crashing the app.
- **Database**: `app/database.py` provides `SessionLocal` (for background tasks) and `get_db` (dependency for API requests).
- **Config**: `app/core/config.py` uses Pydantic `BaseSettings`. Sensitive keys (`DOUBAO_API_KEY`, `SECRET_KEY`) must be env vars.

## 📸 Core Pipeline: Upload → AI Note
1. **Upload**: `InputPipelineService.create_job` validates/stores images (local `uploaded_images/`).
2. **Enqueue**: `POST /api/v1/library/notes/from-image` creates an `UploadJob` (status `QUEUED`) and spawns a background task `process_note_job`.
3. **Processing** (`app/services/pipeline_runner.py`):
   - **Session**: Manually opens/closes `SessionLocal()`.
   - **AI**: Calls `doubao_service.generate_structured_note` (wraps Volcengine SDK).
   - **Persistence**: Saves result via `NoteService.create_note`.
   - **Status**: Updates job status (`RECEIVED` → `AI_PENDING` → `AI_DONE` → `PERSISTED`).
   - **Errors**: Uses `job.append_error(...)` and commits to DB so SSE clients receive updates.

## 🔧 Key Developer Workflows
- **Run Dev Server**: `start.bat` (runs `uvicorn app.main:app --reload`).
- **Run Tests**: `pytest` (configured in `pytest.ini` with coverage requirements).
  - **Markers**: Use `@pytest.mark.unit`, `@pytest.mark.integration`.
  - **Coverage**: Fails if under 70% (`--cov-fail-under=70`).
- **Debug**: Use `debug_request.py` for end-to-end API reproduction.

## 📏 Project Conventions
- **Router Registration**: Always use `_safe_include` in `app/api/v1/api.py`.
- **Background Tasks**:
  - MUST use `SessionLocal()` (not `Depends(get_db)`).
  - MUST catch exceptions, log them, and update job status to `FAILED`.
  - Update `updated_at` with `datetime.now(timezone.utc)` for SSE compatibility.
- **Doubao Integration**:
  - Use `app/services/doubao_service.py` wrapper, do not use SDK directly in business logic.
  - Check `doubao_service.availability_status()` before starting AI tasks.
- **Prompting**: Use `PromptProfile` system (`app/services/prompt_profiles.py`) instead of hardcoded strings.

## 🔌 External Integrations (Doubao/Volcengine)
- **SDK**: `volcengine-python-sdk[ark]`.
- **Auth**: Requires `DOUBAO_API_KEY` (or `ARK_API_KEY`) OR `DOUBAO_ACCESS_KEY_ID`/`SECRET_KEY`.
- **Configuration**: Supports "Thinking Mode" via `DOUBAO_THINKING_MODE` env var.

## 🚨 Common Pitfalls
- **Circular Imports**: Use `TYPE_CHECKING` imports for models/schemas to avoid cycles.
- **Async/Sync**: DB operations are synchronous (SQLAlchemy); run them in threads if blocking the event loop is a concern (though current pipeline runs in background task).
- **Static Files**: Images are served from `/static` (mapped to `uploaded_images/`).
```
