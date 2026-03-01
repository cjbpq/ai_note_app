"""Pydantic schemas for email-code based auth flows."""

from pydantic import BaseModel, EmailStr, Field


class EmailSendCodeRequest(BaseModel):
    """Send verification code to email for a specific purpose."""

    email: EmailStr
    purpose: str = Field(
        ...,
        pattern=r"^(register|login|reset_password|change_email)$",
        description="Code purpose: register | login | reset_password | change_email",
    )


class EmailSendCodeResponse(BaseModel):
    """Email code send response."""

    message: str
    expires_in: int


class EmailRegisterRequest(BaseModel):
    """Register account using email verification code."""

    email: EmailStr
    code: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="6-digit numeric verification code",
    )
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)


class EmailLoginRequest(BaseModel):
    """Login with email verification code."""

    email: EmailStr
    code: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="6-digit numeric verification code",
    )


class ResetPasswordRequest(BaseModel):
    """Reset password with email verification code."""

    email: EmailStr
    code: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="6-digit numeric verification code",
    )
    new_password: str = Field(..., min_length=6, max_length=128)


class ChangePasswordRequest(BaseModel):
    """Change password for authenticated user."""

    old_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=6, max_length=128)


class ChangeEmailRequest(BaseModel):
    """Change bound email with verification code sent to new email."""

    new_email: EmailStr
    code: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="6-digit numeric verification code",
    )


class MessageResponse(BaseModel):
    """Simple message response."""

    message: str


class ChangeEmailResponse(MessageResponse):
    """Response for email change."""

    email: EmailStr
