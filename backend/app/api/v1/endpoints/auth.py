from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.security import create_access_token
from app.database import get_db
from app.models.user import User, Token, TokenInfo, UserCreate, UserLogin, UserResponse
from app.schemas.auth import (
    ChangeEmailRequest,
    ChangeEmailResponse,
    ChangePasswordRequest,
    EmailLoginRequest,
    EmailRegisterRequest,
    EmailSendCodeRequest,
    EmailSendCodeResponse,
    MessageResponse,
    ResetPasswordRequest,
)
from app.services.email_service import email_service
from app.services.user_service import UserService
from app.services.verification_code_service import VerificationCodeService

LOGIN_SUCCESS_EXAMPLE = {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
}

TOKEN_INFO_EXAMPLE = {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 604800,
    "expires_at": "2025-12-07T12:00:00Z",
}

router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="注册账号",
    description="创建一个新用户账号并返回用户信息。",
)
async def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    service = UserService(db)
    try:
        user = service.create_user(user_in.username, user_in.password, user_in.email)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return user


@router.post(
    "/login",
    response_model=Token,
    summary="用户登录",
    description="校验用户名和密码，返回 JWT 访问令牌。",
    responses={
        200: {
            "description": "登录成功",
            "content": {"application/json": {"example": LOGIN_SUCCESS_EXAMPLE}},
        },
        401: {"description": "用户名或密码错误"},
    },
)
async def login_user(credentials: UserLogin, db: Session = Depends(get_db)):
    service = UserService(db)
    user = service.authenticate_user(credentials.username, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}


@router.get(
    "/me",
    response_model=UserResponse,
    summary="获取当前登录用户",
    description="根据 Bearer Token 返回当前用户信息。",
)
async def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.delete(
    "/me",
    status_code=status.HTTP_200_OK,
    summary="注销当前账号",
    description="删除用户和相关数据（笔记、上传任务），返回确认信息。",
)
async def delete_current_user(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = UserService(db)
    deleted = service.delete_user(current_user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return {"message": "用户已注销"}


@router.post(
    "/refresh",
    response_model=TokenInfo,
    summary="刷新访问令牌",
    description="使用有效访问令牌获取新的访问令牌。",
    responses={
        200: {
            "description": "刷新成功",
            "content": {"application/json": {"example": TOKEN_INFO_EXAMPLE}},
        },
        401: {"description": "令牌无效或已过期"},
    },
)
async def refresh_token(current_user: User = Depends(get_current_user)):
    token = create_access_token({"sub": current_user.username})
    expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "expires_at": expires_at.isoformat(),
    }


def _code_error_status(reason: str | None) -> int:
    if reason and "次数" in reason:
        return status.HTTP_429_TOO_MANY_REQUESTS
    return status.HTTP_400_BAD_REQUEST


@router.post(
    "/email/send-code",
    response_model=EmailSendCodeResponse,
    summary="发送邮箱验证码",
    description=(
        "向指定邮箱发送6位数字验证码，用于注册、登录、重置密码、修改绑定邮箱。"
    ),
)
async def send_email_code(
    request: EmailSendCodeRequest,
    db: Session = Depends(get_db),
):
    service = UserService(db)
    code_service = VerificationCodeService(db)

    existing = service.get_user_by_email(request.email)
    if request.purpose in {"register", "change_email"}:
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该邮箱已被注册",
            )
    elif request.purpose in {"login", "reset_password"}:
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该邮箱未注册",
            )

    can_send, reason = code_service.can_send(request.email, request.purpose)
    if not can_send:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=reason)

    record = code_service.create_code(request.email, request.purpose)
    sent = email_service.send_verification_code(request.email, record.code, request.purpose)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="邮件发送失败，请稍后重试",
        )

    return {"message": "验证码已发送", "expires_in": 300}


@router.post(
    "/email/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="邮箱验证码注册",
    description="使用邮箱验证码完成注册，需提供验证码、用户名和密码。",
)
async def email_register(
    request: EmailRegisterRequest,
    db: Session = Depends(get_db),
):
    code_service = VerificationCodeService(db)
    valid, reason = code_service.verify_code(request.email, request.code, "register")
    if not valid:
        raise HTTPException(status_code=_code_error_status(reason), detail=reason)

    service = UserService(db)
    try:
        user = service.create_user_with_verified_email(
            username=request.username,
            password=request.password,
            email=request.email,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return user


@router.post(
    "/email/login",
    response_model=Token,
    summary="邮箱验证码登录",
    description="使用邮箱和验证码登录，返回 JWT 访问令牌。",
    responses={
        200: {
            "description": "登录成功",
            "content": {"application/json": {"example": LOGIN_SUCCESS_EXAMPLE}},
        },
    },
)
async def email_login(
    request: EmailLoginRequest,
    db: Session = Depends(get_db),
):
    code_service = VerificationCodeService(db)
    valid, reason = code_service.verify_code(request.email, request.code, "login")
    if not valid:
        raise HTTPException(status_code=_code_error_status(reason), detail=reason)

    service = UserService(db)
    user = service.get_user_by_email(request.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="该邮箱未注册",
        )

    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}


@router.post(
    "/password/reset",
    response_model=MessageResponse,
    summary="忘记密码/重置密码",
    description="校验邮箱验证码后，重置指定邮箱账号密码。",
)
async def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    code_service = VerificationCodeService(db)
    valid, reason = code_service.verify_code(request.email, request.code, "reset_password")
    if not valid:
        raise HTTPException(status_code=_code_error_status(reason), detail=reason)

    service = UserService(db)
    try:
        service.reset_password_by_email(request.email, request.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return {"message": "密码已重置"}


@router.post(
    "/password/change",
    response_model=MessageResponse,
    summary="修改密码",
    description="已登录用户输入旧密码并验证通过后修改密码。",
)
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = UserService(db)
    db_user = service.get_user_by_id(current_user.id)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    try:
        service.change_password(db_user, request.old_password, request.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return {"message": "密码修改成功"}


@router.post(
    "/email/change",
    response_model=ChangeEmailResponse,
    summary="修改绑定邮箱",
    description="校验新邮箱验证码后，更新当前登录用户绑定邮箱。",
)
async def change_email(
    request: ChangeEmailRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    code_service = VerificationCodeService(db)
    valid, reason = code_service.verify_code(request.new_email, request.code, "change_email")
    if not valid:
        raise HTTPException(status_code=_code_error_status(reason), detail=reason)

    service = UserService(db)
    db_user = service.get_user_by_id(current_user.id)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    try:
        updated_user = service.change_email(db_user, str(request.new_email))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return {"message": "绑定邮箱修改成功", "email": updated_user.email}
