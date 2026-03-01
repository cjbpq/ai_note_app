import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# Force a deterministic local test configuration.
os.environ["SECRET_KEY"] = "test-secret-key-with-sufficient-length-32-bytes-minimum-requirement"
os.environ["ALLOWED_ORIGINS"] = "http://localhost:3000,http://localhost:5173"
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["DEBUG"] = "false"

from app.core.security import get_password_hash
from app.database import Base
from app.main import app


@pytest.fixture(scope="function")
def db_session() -> Session:
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user(db_session: Session):
    from app.models.user import User

    user = User(
        id="test-user-123",
        username="testuser",
        email="test@example.com",
        password_hash=get_password_hash("TestPassword123"),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_client():
    with TestClient(app) as client:
        yield client


@pytest.fixture
def auth_token(test_client):
    username = f"testuser_{uuid.uuid4().hex[:8]}"
    password = "TestPassword123"
    email = f"{username}@example.com"

    register_response = test_client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": password, "email": email},
    )
    assert register_response.status_code in (200, 201)

    login_response = test_client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert login_response.status_code == 200
    return login_response.json()["access_token"]


@pytest.fixture
def mock_doubao_service(monkeypatch):
    class MockDoubaoService:
        is_available = True

        @staticmethod
        def availability_status():
            return True, None

        @staticmethod
        def generate_structured_note(*args, **kwargs):
            return {
                "note": {
                    "title": "Mock note title",
                    "summary": "Mock summary",
                    "raw_text": "Mock raw text",
                    "category": "Learning note",
                }
            }

        @staticmethod
        def generate_plain_text(*args, **kwargs):
            return {
                "text": "Mock extracted text",
                "format": "markdown",
                "response": {},
            }

    mock = MockDoubaoService()
    monkeypatch.setattr("app.services.doubao_service.doubao_service", mock)
    monkeypatch.setattr("app.core.dependencies.doubao_service", mock)
    return mock
