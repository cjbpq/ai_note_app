# AI Agent Guide for AI Note Backend

## 🧭 Architecture Overview
- **Entry Point**: `app/main.py` — lifespan context manager for startup (DB init, logging via `setup_logging()`)
- **Routing**: `app/api/v1/api.py` — use `_safe_include(module, attr, prefix, tags)` to register routers (gracefully handles import errors)
- **Database**: `app/database.py` — `SessionLocal` for background tasks, `get_db` dependency for API requests
- **Config**: `app/core/config.py` — Pydantic `BaseSettings`; `SECRET_KEY` is required (min 32 chars), `DOUBAO_API_KEY` from env

## 📸 Core Pipeline: Image → AI Note
```
POST /api/v1/library/notes/from-image
    → InputPipelineService.create_job() [validates, stores to uploaded_images/]
    → UploadJob created (status=QUEUED)
    → BackgroundTasks.add_task(process_note_job, ...)
```
**`pipeline_runner.py` flow**:
1. Open `SessionLocal()` manually (NOT `Depends(get_db)`)
2. Check `doubao_service.availability_status()` → fail fast if unavailable
3. Call `doubao_service.generate_structured_note()` via `asyncio.to_thread()`
4. Save via `NoteService.create_note()`, update job status: `AI_PENDING → AI_DONE → PERSISTED`
5. On error: `job.append_error({stage, error})`, set status=`FAILED`, commit immediately

## 🔧 Developer Workflows
| Task | Command |
|------|---------|
| Run dev server | `start.bat` or `uvicorn app.main:app --reload` |
| Run all tests | `pytest` (auto-runs with coverage) |
| Unit tests only | `pytest -m unit` |
| Security tests | `pytest tests/security/ -v` |
| Golden baseline | `pytest tests/golden/ --golden-update` |
| Check coverage | Open `htmlcov/index.html` after pytest |

**Test markers**: `@pytest.mark.unit`, `@pytest.mark.integration`, `@pytest.mark.security`, `@pytest.mark.golden`
**Coverage gate**: Fails if < 70% (`--cov-fail-under=70` in `pytest.ini`)

## 📏 Code Conventions
### Router Registration
```python
# In app/api/v1/api.py — ALWAYS use _safe_include
_safe_include("app.api.v1.endpoints.library", "router", prefix="/library", tags=["Library"])
```

### Background Tasks
```python
# ✅ Correct: manual session, explicit error handling
db = SessionLocal()
try:
    # work...
    job.status = "PERSISTED"
    job.updated_at = datetime.now(timezone.utc)  # NOT utcnow()
    db.commit()
finally:
    db.close()
```

### Exception Handling
- Raise `ServiceError` subclasses (`DoubaoServiceUnavailable`, `NoteNotFoundError`) — caught by global handler in `main.py`
- Use dependency injection for pre-checks: `dependencies=[Depends(check_doubao_available)]`

### Pydantic v2
- Use `.model_dump()` not `.dict()`
- Use `model_validator(mode="after")` not `@validator`

## 🤖 AI/Doubao Integration
- **Wrapper**: Always use `doubao_service` singleton from `app/services/doubao_service.py`
- **Prompts**: Use `PromptProfile` system (`app/services/prompt_profiles.py`) — supports `general`, `math`, `english`, `physics`, `classical_chinese`
- **JSON Schema**: Controlled by `DOUBAO_USE_JSON_SCHEMA` env var
- **Auth priority**: `DOUBAO_API_KEY` > `ARK_API_KEY` > `VOLC_ACCESSKEY`+`VOLC_SECRETKEY`

## 🗂 Key Files Reference
| Purpose | File |
|---------|------|
| App entry & lifecycle | `app/main.py` |
| Router aggregation | `app/api/v1/api.py` |
| AI pipeline runner | `app/services/pipeline_runner.py` |
| Doubao wrapper | `app/services/doubao_service.py` |
| Prompt templates | `app/services/prompt_profiles.py`, `app/prompts/profiles.json` |
| Custom exceptions | `app/core/exceptions.py` |
| Test fixtures | `tests/conftest.py`, `tests/factories.py` |

## 🚨 Common Pitfalls
- **Circular imports**: Use `TYPE_CHECKING` for model/schema imports
- **utcnow() deprecated**: Use `datetime.now(timezone.utc)` (Python 3.12+)
- **Static files**: Served from `/static` → mapped to `uploaded_images/`
- **Missing cleanup**: `pipeline_runner.py` auto-deletes image after success — check `Path.unlink()` behavior if debugging
