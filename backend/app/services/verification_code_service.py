"""Verification code lifecycle service."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.models.email_verification_code import EmailVerificationCode

CODE_LENGTH = 6
CODE_EXPIRE_MINUTES = 5
MAX_ATTEMPTS = 5
SEND_INTERVAL_SECONDS = 60


class VerificationCodeService:
    """Domain service for generating and validating verification codes."""

    def __init__(self, db: Session):
        self.db = db

    def generate_code(self) -> str:
        return "".join(str(secrets.randbelow(10)) for _ in range(CODE_LENGTH))

    def can_send(self, email: str, purpose: str) -> Tuple[bool, Optional[str]]:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=SEND_INTERVAL_SECONDS)
        recent = (
            self.db.query(EmailVerificationCode)
            .filter(
                EmailVerificationCode.email == email,
                EmailVerificationCode.purpose == purpose,
                EmailVerificationCode.created_at > cutoff,
            )
            .first()
        )
        if recent:
            return False, "发送过于频繁，请稍后再试"
        return True, None

    def create_code(self, email: str, purpose: str) -> EmailVerificationCode:
        self.db.query(EmailVerificationCode).filter(
            EmailVerificationCode.email == email,
            EmailVerificationCode.purpose == purpose,
            EmailVerificationCode.is_used == False,  # noqa: E712
        ).update({"is_used": True})

        code = self.generate_code()
        record = EmailVerificationCode(
            email=email,
            code=code,
            purpose=purpose,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRE_MINUTES),
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def verify_code(self, email: str, code: str, purpose: str) -> Tuple[bool, Optional[str]]:
        record = (
            self.db.query(EmailVerificationCode)
            .filter(
                EmailVerificationCode.email == email,
                EmailVerificationCode.purpose == purpose,
                EmailVerificationCode.is_used == False,  # noqa: E712
            )
            .order_by(EmailVerificationCode.created_at.desc())
            .first()
        )

        if not record:
            return False, "验证码不存在或已使用"

        now = datetime.now(timezone.utc)
        expires_at = self._to_aware_utc(record.expires_at)
        if now > expires_at:
            return False, "验证码已过期"

        if record.attempts >= MAX_ATTEMPTS:
            return False, "验证码尝试次数过多，请重新获取"

        record.attempts += 1
        self.db.commit()

        if record.code != code:
            return False, "验证码错误"

        record.is_used = True
        self.db.commit()
        return True, None

    @staticmethod
    def _to_aware_utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
