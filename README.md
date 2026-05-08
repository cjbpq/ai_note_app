# SnapNote AI Note App

SnapNote is an AI-assisted note taking application. It combines a mobile frontend with a FastAPI backend so users can upload note images, generate structured AI notes, browse categories, search locally, and keep note data available in the app.

The project is currently in active MVP development.

## Features

- Image-to-note workflow powered by the backend AI pipeline
- Multi-image upload and background processing jobs
- User authentication and account management
- Note browsing, editing, favorite status, categories, and search
- Incremental sync and offline mutation replay support
- Expo React Native mobile app with local cache/storage
- Backend tests for auth, upload jobs, sync, security, and AI pipeline behavior

## Repository Structure

```text
backend/     FastAPI API, SQLAlchemy models, services, Alembic migrations, tests
frontend/    Expo React Native app, screens, components, hooks, stores, services
```

## Tech Stack

Backend:

- FastAPI
- SQLAlchemy
- Pydantic v2
- PostgreSQL or SQLite for local testing
- Uvicorn
- Volcengine Ark/Doubao SDK
- Pytest

Frontend:

- Expo
- React Native
- TypeScript
- Expo Router
- Zustand
- TanStack Query
- React Native Paper
- SQLite and AsyncStorage

## Backend Setup

For day-to-day backend work, use a local virtual environment and a local
PostgreSQL database. If Docker is installed, the repository includes a small
Postgres compose file:

```powershell
cd backend
docker compose -f docker-compose.dev.yml up -d
```

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-test.txt
copy .env.example .env
```

Edit `backend/.env` with your local settings. At minimum, set a 32+ character `SECRET_KEY`, a `DATABASE_URL`, and an `UPLOAD_DIR` outside the backend project directory.

Apply database migrations before starting the API:

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Run the API:

```powershell
cd backend
.\start.bat
```

Or run directly:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Run backend tests:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

## Frontend Setup

```powershell
cd frontend
npm install
copy .env.example .env
npm run start
```

Set `EXPO_PUBLIC_API_URL` in `frontend/.env` to your backend API URL, for example:

```text
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
EXPO_PUBLIC_USE_MOCK=false
```

## Environment Files

Real `.env` files are intentionally ignored by Git. Use:

- `backend/.env.example` for backend configuration reference
- `frontend/.env.example` for frontend configuration reference

Do not commit real API keys, database files, logs, virtual environments, local AI tool state, or generated coverage/benchmark output.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
