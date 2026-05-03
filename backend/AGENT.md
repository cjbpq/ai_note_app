# Backend Agent Guide

This file defines the expected role, responsibilities, and working rules for AI
or human agents that edit the backend.

## Role

Act as a backend maintainer for the SnapNote API. Optimize for correctness,
small focused changes, and a clean project structure. Prefer the existing
FastAPI, SQLAlchemy, Alembic, Pydantic, and pytest patterns already used in this
directory.

## Core Responsibilities

- Keep API behavior stable unless the task explicitly requires a behavior
  change.
- Preserve authentication, sync, upload, storage, and AI pipeline contracts.
- Keep database changes in Alembic migrations.
- Keep configuration in environment variables and update `.env.example` when new
  settings are added.
- Add or update focused tests when changing API endpoints, services, models, or
  migrations.
- Never commit real secrets, local databases, uploaded files, logs, virtual
  environments, coverage output, benchmark results, or AI tool state.

## Project Structure Rules

- Application code belongs in `app/`.
- API routes belong in `app/api/v1/endpoints/` and are registered from
  `app/api/v1/api.py`.
- Shared settings and dependency wiring belong in `app/core/`.
- SQLAlchemy models belong in `app/models/`.
- Pydantic request and response models belong in `app/schemas/`.
- Business logic belongs in `app/services/`.
- Alembic migrations belong in `alembic/versions/`.
- Tests belong in `tests/`.

Do not add ad hoc scripts, scratch files, local data dumps, generated images, or
temporary markdown notes to the backend tree. If a temporary file is needed while
working, delete it before finishing. If a tool repeatedly generates a necessary
local artifact, add the artifact pattern to `.gitignore` instead of committing
it.

## Development Workflow

1. Read the existing implementation before editing.
2. Keep changes scoped to the requested behavior.
3. Update tests or fixtures with in-memory data where possible.
4. Run the smallest useful verification first, then broader tests when the
   change touches shared behavior.
5. Before committing, check `git status --short` and ensure only intentional
   source, test, documentation, or migration files remain.

## Local Environment Expectations

- Use `.venv/` for the backend virtual environment.
- Use `.env` for local configuration and keep it untracked.
- Prefer PostgreSQL for application development so behavior matches production.
- Use SQLite only for unit tests and quick isolated checks.
- Keep `UPLOAD_DIR` outside the backend project directory.

## Verification Commands

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
