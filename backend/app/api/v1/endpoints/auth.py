from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_token
from app.database import get_db
from app.models.user import User, UserCreate, UserLogin, UserResponse, Token, TokenInfo
from app.services.user_service import UserService
from app.core.dependencies import get_current_user
from app.core.config import settings

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
    description="创建一个新的用户账号并返回用户信息。",
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
async def read_current_user(current_user=Depends(get_current_user)):
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
    description=(
        "使用有效的访问令牌获取新的令牌，无需重新输入用户名密码。"
        "前端可在 Token 即将过期前调用此接口续期。"
    ),
    responses={
        200: {
            "description": "刷新成功",
            "content": {"application/json": {"example": TOKEN_INFO_EXAMPLE}},
        },
        401: {"description": "令牌无效或已过期"},
    },
)
async def refresh_token(current_user: User = Depends(get_current_user)):
    """刷新 Token

    使用场景:
    - 前端检测到 Token 即将过期时自动调用
    - 用户长时间活跃时定期刷新
    - 无需用户重新输入密码

    注意: 此接口仍需要有效的 Token 才能调用，
    如果 Token 已完全过期，用户需要重新登录。
    """
    from datetime import datetime, timezone, timedelta

    token = create_access_token({"sub": current_user.username})
    expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # 转换为秒
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "expires_at": expires_at.isoformat(),
    }
