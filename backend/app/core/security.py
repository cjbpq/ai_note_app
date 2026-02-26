import jwt
import bcrypt
from datetime import datetime, timedelta, timezone  # 新增 timezone 导入
from typing import Optional
from app.core.config import settings

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """创建JWT访问令牌

    学习要点:
    - datetime.utcnow() 在 Python 3.12+ 已弃用 (返回 naive datetime)
    - datetime.now(timezone.utc) 返回时区感知的 datetime 对象 (aware datetime)
    - 时区感知的 datetime 可以避免时区转换错误 (如跨时区用户场景)
    - JWT 的 exp 字段会自动处理 Unix 时间戳, 但应用层应统一使用 UTC 时间
    """
    to_encode = data.copy()
    if expires_delta:
        # 改前问题: datetime.utcnow() 返回 naive datetime (无时区信息)
        # 为什么改: 使用 timezone-aware datetime 防止时区转换错误
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    """生成密码哈希"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_token(token: str) -> Optional[dict]:
    """验证JWT令牌"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None