from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_sqlite_schema_compatibility() -> None:
    """Apply additive columns for local SQLite databases created by older metadata."""

    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "users" in table_names:
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "chat_thinking_enabled" not in user_columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE users ADD COLUMN chat_thinking_enabled BOOLEAN NOT NULL DEFAULT 0"))

    if "chat_conversations" in table_names:
        conversation_columns = {column["name"] for column in inspector.get_columns("chat_conversations")}
        statements = []
        if "context_summary" not in conversation_columns:
            statements.append("ALTER TABLE chat_conversations ADD COLUMN context_summary TEXT")
        if "context_compacted_until_sequence" not in conversation_columns:
            statements.append("ALTER TABLE chat_conversations ADD COLUMN context_compacted_until_sequence INTEGER")
        if "context_summary_updated_at" not in conversation_columns:
            statements.append("ALTER TABLE chat_conversations ADD COLUMN context_summary_updated_at DATETIME")
        if statements:
            with engine.begin() as connection:
                for statement in statements:
                    connection.execute(text(statement))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
