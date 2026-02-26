import json
import sqlite3
import uuid
from datetime import datetime

from app.core.security import get_password_hash


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    columns = {row[1] for row in conn.execute("PRAGMA table_info(notes)")}
    if "user_id" not in columns:
        conn.execute("ALTER TABLE notes ADD COLUMN user_id TEXT")


def ensure_note():
    conn = sqlite3.connect("app.db")
    now = datetime.utcnow().isoformat()

    ensure_schema(conn)

    user_id = str(uuid.uuid4())
    note_id = str(uuid.uuid4())

    user_data = {
        "id": user_id,
        "username": "test-user",
        "email": "test@example.com",
        "password_hash": get_password_hash("password123"),
        "created_at": now,
        "updated_at": now,
    }

    note_data = {
        "id": note_id,
        "user_id": user_id,
        "device_id": user_id,
        "title": "测试笔记",
        "category": "学习笔记",
        "tags": json.dumps(["测试", "自动化"]),
        "image_url": "/static/mock.png",
        "image_filename": "mock.png",
        "image_size": 12345,
        "original_text": "这是一条用于接口测试的笔记正文。",
        "structured_data": json.dumps({"summary": "测试summary", "sections": [], "key_points": []}),
        "is_favorite": 0,
        "is_archived": 0,
        "created_at": now,
        "updated_at": now,
    }

    with conn:
        conn.execute("DELETE FROM users WHERE username=?", (user_data["username"],))
        conn.execute(
            """
            INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
            VALUES (:id, :username, :email, :password_hash, :created_at, :updated_at)
            """,
            user_data,
        )

        conn.execute("DELETE FROM notes WHERE user_id=?", (user_id,))
        conn.execute(
            """
            INSERT INTO notes (
                id, user_id, device_id, title, category, tags,
                image_url, image_filename, image_size, original_text,
                structured_data, is_favorite, is_archived, created_at, updated_at
            ) VALUES (
                :id, :user_id, :device_id, :title, :category, :tags,
                :image_url, :image_filename, :image_size, :original_text,
                :structured_data, :is_favorite, :is_archived, :created_at, :updated_at
            )
            """,
            note_data,
        )

    conn.close()
    print(f"Seeded user 'test-user' with note {note_id}")


ensure_note()
