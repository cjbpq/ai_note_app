import os
from typing import Optional

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    # 改前问题: SECRET_KEY 硬编码默认值 "your-secret-key-change-in-production", 容易被攻击者伪造 JWT token
    # 为什么改: 从环境变量强制加载, 防止密钥泄露到版本控制系统
    # 学习要点: 敏感配置应使用环境变量, 永不提交到版本控制. 使用 Field(...) 标记为必填字段
    SECRET_KEY: str = Field(
        ...,  # 必填字段, 启动时未配置会报错
        min_length=32,  # 最小长度 32 字节, 确保密钥强度
        description="JWT 签名密钥 (必须从环境变量加载, 使用 python -c \"import secrets; print(secrets.token_urlsafe(32))\" 生成)",
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # 改前问题: CORS 未配置白名单, 允许任何域名访问 (allow_origins=["*"])
    # 为什么改: 限制为前端域名白名单, 防止 CSRF 攻击
    # 学习要点: allow_origins=["*"] + allow_credentials=True 会导致恶意网站能利用用户浏览器 cookies 调用本项目 API
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:5173",
        description="允许的 CORS 源 (逗号分隔). 生产环境应设置为实际前端域名 (如 https://app.example.com)",
    )

    # Database
    DATABASE_URL: str = "sqlite:///./app.db"

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
