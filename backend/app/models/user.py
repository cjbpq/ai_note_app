from datetime import datetime
from typing import Optional
import uuid

from pydantic import BaseModel, EmailStr
from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# Pydantic 模式 (用于API请求/响应)
class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(UserBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenInfo(BaseModel):
    """带有过期时间信息的 Token 响应

    用于 /auth/refresh 接口，前端可以根据 expires_in 或 expires_at
    决定何时刷新 Token。
    """
    access_token: str
    token_type: str
    expires_in: int  # Token 有效期（秒）
    expires_at: str  # Token 过期时间（ISO 8601 格式）


class TokenData(BaseModel):
    username: Optional[str] = None