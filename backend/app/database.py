from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_sqlite_schema() -> None:
    """对当前 SQLite 数据库执行最小结构校验，补充缺失列。"""

    if not settings.DATABASE_URL.startswith("sqlite"):
        return

    with engine.connect() as connection:
        try:
            result = connection.execute(text("PRAGMA table_info(notes)"))
            columns = {row[1] for row in result}
            if "user_id" not in columns:
                connection.execute(text("ALTER TABLE notes ADD COLUMN user_id VARCHAR(36)"))
            # 多图迁移: 旧单图字段 → 新 JSON 列表字段
            if "image_urls" not in columns and "image_url" in columns:
                connection.execute(text("ALTER TABLE notes ADD COLUMN image_urls JSON DEFAULT '[]'"))
                connection.execute(text("ALTER TABLE notes ADD COLUMN image_filenames JSON DEFAULT '[]'"))
                connection.execute(text("ALTER TABLE notes ADD COLUMN image_sizes JSON DEFAULT '[]'"))
                # 将旧数据迁移到新字段
                connection.execute(text(
                    "UPDATE notes SET "
                    "image_urls = json_array(image_url), "
                    "image_filenames = json_array(image_filename), "
                    "image_sizes = json_array(image_size)"
                ))
                connection.commit()
            elif "image_urls" not in columns:
                connection.execute(text("ALTER TABLE notes ADD COLUMN image_urls JSON DEFAULT '[]'"))
                connection.execute(text("ALTER TABLE notes ADD COLUMN image_filenames JSON DEFAULT '[]'"))
                connection.execute(text("ALTER TABLE notes ADD COLUMN image_sizes JSON DEFAULT '[]'"))
                connection.commit()
        except Exception:
            # 如果 notes 表不存在，则忽略，后续 create_all 会创建
            pass
