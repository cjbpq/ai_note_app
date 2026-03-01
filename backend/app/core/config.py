import os
from pathlib import Path
from typing import Optional

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Application configuration loaded from environment variables/.env."""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="allow")

    # App metadata
    APP_NAME: str = "AI Note API"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: Optional[str] = None
    DEBUG: bool = True

    # API namespace
    API_V1_STR: str = "/api/v1"

    # Security
    # ????: SECRET_KEY ?????? "your-secret-key-change-in-production", ???????? JWT token
    # ????: ?????????, ?????????????
    # ????: ???????????, ?????????. ?? Field(...) ???????
    SECRET_KEY: str = Field(
        ...,  # ????, ?????????
        min_length=32,  # ???? 32 ??, ??????
        description="JWT ???? (?????????, ?? python -c \"import secrets; print(secrets.token_urlsafe(32))\" ??)",
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # ????: CORS ??????, ???????? (allow_origins=["*"])
    # ????: ??????????, ?? CSRF ??
    # ????: allow_origins=["*"] + allow_credentials=True ??????????????? cookies ????? API
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:5173",
        description="??? CORS ? (????). ?????????????? (? https://app.example.com)",
    )

    # Timezone (?? API ??????????????????)
    TIMEZONE: str = "Asia/Shanghai"

    # ?????? (SMTP)
    SMTP_HOST: str = "smtp.exmail.qq.com"
    SMTP_PORT: int = 465
    SMTP_USE_SSL: bool = True
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "AI Note"

    # Database
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/ai_note_app"
    UPLOAD_DIR: str = "/var/www/ai_note_app/shared/uploaded_images"

    # Doubao configuration
    USE_DOUBAO_PIPELINE: bool = True
    DOUBAO_API_KEY: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("DOUBAO_API_KEY", "ARK_API_KEY"),
    )
    DOUBAO_ACCESS_KEY_ID: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices(
            "DOUBAO_ACCESS_KEY_ID",
            "ARK_ACCESS_KEY_ID",
            "VOLC_ACCESSKEY",
        ),
    )
    DOUBAO_SECRET_ACCESS_KEY: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices(
            "DOUBAO_SECRET_ACCESS_KEY",
            "ARK_SECRET_ACCESS_KEY",
            "VOLC_SECRETKEY",
        ),
    )
    DOUBAO_BASE_URL: str = "https://ark.cn-beijing.volces.com/api/v3"
    DOUBAO_MODEL_ID: str = "doubao-seed-1-6-vision-250815"
    DOUBAO_DETAIL: Optional[str] = "high"
    DOUBAO_MAX_COMPLETION_TOKENS: Optional[int] = 6000
    DOUBAO_THINKING_MODE: Optional[str] = None
    DOUBAO_USE_JSON_SCHEMA: bool = True
    DOUBAO_ALLOW_LEGACY_FALLBACK: bool = False

    PROMPT_PROFILES_PATH: str = Field(
        default="app/prompts/profiles.json",
        validation_alias=AliasChoices("PROMPT_PROFILES_PATH", "AI_PROMPT_PROFILES_PATH"),
    )

    ADMIN_PORTAL_API_KEY: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("ADMIN_PORTAL_API_KEY", "PROMPT_ADMIN_KEY"),
    )

    @field_validator("DEBUG", mode="before")
    @classmethod
    def _parse_debug_flag(cls, value):
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            truthy = {"1", "true", "yes", "on", "debug", "dev", "development"}
            falsy = {"0", "false", "no", "off", "release", "prod", "production"}
            if normalized in truthy:
                return True
            if normalized in falsy:
                return False
        return value

    @field_validator("UPLOAD_DIR")
    @classmethod
    def _validate_upload_dir(cls, value: str) -> str:
        upload_dir = Path(value).expanduser()
        normalized = upload_dir.resolve() if upload_dir.is_absolute() else (PROJECT_ROOT / upload_dir).resolve()
        if normalized == PROJECT_ROOT or PROJECT_ROOT in normalized.parents:
            raise ValueError("UPLOAD_DIR must be outside the backend project directory")
        return str(normalized)

    @model_validator(mode="after")
    def _apply_doubao_alias_fallbacks(cls, values: "Settings") -> "Settings":
        extras = getattr(values, "model_extra", {}) or {}

        if not values.DOUBAO_ACCESS_KEY_ID:
            fallback_access = (
                extras.get("ARK_ACCESS_KEY_ID")
                or extras.get("VOLC_ACCESSKEY")
                or os.getenv("ARK_ACCESS_KEY_ID")
                or os.getenv("VOLC_ACCESSKEY")
            )
            if fallback_access:
                values.DOUBAO_ACCESS_KEY_ID = fallback_access

        if not values.DOUBAO_SECRET_ACCESS_KEY:
            fallback_secret = (
                extras.get("ARK_SECRET_ACCESS_KEY")
                or extras.get("VOLC_SECRETKEY")
                or os.getenv("ARK_SECRET_ACCESS_KEY")
                or os.getenv("VOLC_SECRETKEY")
            )
            if fallback_secret:
                values.DOUBAO_SECRET_ACCESS_KEY = fallback_secret

        return values


settings = Settings()
