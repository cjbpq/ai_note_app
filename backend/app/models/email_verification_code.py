"""邮箱验证码模型：存储验证码记录，用于邮箱注册和邮箱登录的验证码校验。"""

import uuid

from sqlalchemy import Boolean, Column, DateTime, Index, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class EmailVerificationCode(Base):
    """邮箱验证码 —— 记录发送给用户的验证码

    验证码有效期 5 分钟，单个验证码最多允许 5 次尝试，
    验证成功后标记 is_used 防止重复使用。
    """

    __tablename__ = "email_verification_codes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    purpose = Column(String(20), nullable=False)  # "register" | "login"
    attempts = Column(Integer, nullable=False, default=0)
    is_used = Column(Boolean, nullable=False, default=False)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_email_codes_email_purpose", "email", "purpose"),
    )

    def __repr__(self) -> str:
        return f"<EmailVerificationCode(email={self.email}, purpose={self.purpose})>"
