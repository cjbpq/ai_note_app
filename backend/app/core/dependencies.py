from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.security import verify_token
from app.core.exceptions import DoubaoServiceUnavailable
from app.database import get_db
from app.models.user import User
from app.services.user_service import UserService
from app.services.doubao_service import doubao_service

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """获取当前用户依赖"""
    token = credentials.credentials
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    username: str = payload.get("sub")
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证令牌",
        )
    
    user_service = UserService(db)
    user = user_service.get_user_by_username(username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )

    return user


async def check_doubao_available() -> None:
    """检查 Doubao 服务可用性 (依赖注入)

    学习要点:
    - FastAPI Depends 是依赖注入的核心机制
    - 提取重复逻辑到依赖函数, 提升代码复用
    - 依赖函数可以抛出异常, 自动中断请求

    为什么这么改:
    1. 代码复用: doubao 可用性检查逻辑只写一次 (原来在 library.py 重复 2 次)
    2. 关注点分离: 端点函数专注业务逻辑, 不关心服务可用性检查
    3. 易于测试: 可以 mock 这个依赖函数, 模拟服务不可用场景

    使用方式:
    @router.post("/notes/from-image", dependencies=[Depends(check_doubao_available)])
    async def create_note_from_image(...):
        # 此时 doubao 已确认可用, 直接使用
        pass
    """
    available, reason = doubao_service.availability_status()
    if not available:
        # 抛出自定义异常, 全局异常处理器会捕获并返回标准错误格式
        raise DoubaoServiceUnavailable(reason)