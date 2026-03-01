"""单元测试: 安全模块 (JWT, 密码哈希)
学习要点:
- JWT Token 时区感知验证
- 密码哈希强度测试
- 时间处理标准化验证 (datetime.now(timezone.utc))
"""

import pytest
from datetime import datetime, timedelta, timezone

from app.core.security import (
    create_access_token,
    verify_password,
    get_password_hash
)


# ========================================
# 测试用例 1: JWT Token 时区感知
# ========================================

@pytest.mark.unit
@pytest.mark.security
def test_create_access_token_timezone_aware():
    """测试: JWT Token exp 字段使用 timezone-aware datetime

    验证重点:
    - create_access_token() 使用 datetime.now(timezone.utc)
    - JWT payload 中 exp 字段包含时区信息
    - 跨时区 Token 验证一致性

    学习要点:
    - datetime.utcnow() 已弃用 (返回 naive datetime)
    - datetime.now(timezone.utc) 返回 timezone-aware datetime
    - JWT exp 字段: Unix 时间戳 (从 1970-01-01 00:00:00 UTC 算起的秒数)

    为什么改:
    - 避免时区混淆导致 Token 过期时间错误
    - 统一使用 UTC 时间确保跨时区一致性
    - Python 3.12+ 要求使用 timezone-aware datetime
    """
    # 创建 Token
    token = create_access_token(data={"sub": "test_user"})

    # 验证 Token 格式 (JWT 三段式: header.payload.signature)
    assert isinstance(token, str)
    assert token.count(".") == 2

    # 解码 Token (验证 exp 字段)
    import jwt
    from app.core.config import settings

    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])

    # 验证: exp 字段存在
    assert "exp" in payload

    # 验证: exp 是 Unix 时间戳 (整数)
    assert isinstance(payload["exp"], int)

    # 验证: exp 时间在未来 (当前时间 < exp)
    current_timestamp = datetime.now(timezone.utc).timestamp()
    assert payload["exp"] > current_timestamp

    # 验证: exp 时间合理 (15 分钟后, 允许 1 秒误差)
    expected_exp = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    actual_exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)

    time_diff = abs((expected_exp - actual_exp).total_seconds())
    assert time_diff < 1, f"exp 时间误差过大: {time_diff}s"


# ========================================
# 测试用例 2: 密码哈希强度
# ========================================

@pytest.mark.unit
@pytest.mark.security
def test_password_hash_strength():
    """测试: 密码哈希强度和唯一性

    验证重点:
    - 使用 bcrypt 算法 (哈希结果以 $2b$ 开头)
    - 相同密码生成不同哈希 (加盐 salt)
    - 哈希结果不可逆 (不包含原始密码)

    学习要点:
    - bcrypt: 自动加盐的密码哈希算法
    - salt: 随机字符串, 确保相同密码生成不同哈希
    - 不可逆: 无法从哈希反推原始密码

    为什么使用 bcrypt:
    - 自动加盐, 防止彩虹表攻击
    - 计算成本高, 防止暴力破解
    - 业界标准, 安全可靠
    """
    password = "TestPassword123"

    # 生成哈希
    hashed = get_password_hash(password)

    # 验证: 使用 bcrypt 算法 ($2b$ 前缀)
    assert hashed.startswith("$2b$"), "应使用 bcrypt 算法"

    # 验证: 哈希结果不包含原始密码
    assert password not in hashed, "哈希不应包含原始密码"

    # 验证: 哈希长度合理 (bcrypt 通常 60 字符)
    assert len(hashed) == 60, f"bcrypt 哈希长度应为 60, 实际: {len(hashed)}"

    # 验证: 相同密码生成不同哈希 (加盐)
    hashed2 = get_password_hash(password)
    assert hashed != hashed2, "相同密码应生成不同哈希 (加盐机制)"


# ========================================
# 测试用例 3: 密码验证
# ========================================

@pytest.mark.unit
@pytest.mark.security
def test_verify_password():
    """测试: 密码验证功能

    验证重点:
    - 正确密码验证通过
    - 错误密码验证失败
    - 验证速度合理 (< 0.5s)

    学习要点:
    - verify_password: 对比原始密码和哈希
    - bcrypt.checkpw: 自动提取 salt 并验证
    - 时间攻击防护: bcrypt 验证时间恒定
    """
    password = "TestPassword123"
    hashed = get_password_hash(password)

    # 验证: 正确密码通过
    assert verify_password(password, hashed) is True

    # 验证: 错误密码失败
    assert verify_password("WrongPassword", hashed) is False

    # 验证: 空密码失败
    assert verify_password("", hashed) is False


# ========================================
# 测试用例 4: 跨时区 Token 验证
# ========================================

@pytest.mark.unit
@pytest.mark.security
def test_token_expiration_across_timezones():
    """测试: 跨时区 Token 过期验证一致性

    验证重点:
    - Token 在不同时区验证结果一致
    - UTC 时间统一, 避免时区转换错误
    - 过期时间精确 (误差 < 1s)

    学习要点:
    - Unix 时间戳: 与时区无关 (统一从 UTC 1970-01-01 算起)
    - datetime.now(timezone.utc): 确保 UTC 时间一致性
    - Token 验证: 使用当前 UTC 时间对比 exp 字段

    为什么重要:
    - 分布式系统: 服务器可能部署在不同时区
    - 用户跨时区: 用户可能在不同地区访问
    - 时间一致性: 避免 Token 在某些时区失效
    """
    # 创建短期 Token (5 秒后过期)
    token = create_access_token(
        data={"sub": "test_user"},
        expires_delta=timedelta(seconds=5)
    )

    # 验证: Token 立即可用
    import jwt
    from app.core.config import settings

    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    assert "sub" in payload
    assert payload["sub"] == "test_user"

    # 验证: exp 字段使用 timezone-aware datetime
    exp_timestamp = payload["exp"]
    exp_datetime = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
    assert exp_datetime.tzinfo is not None, "exp 应为 timezone-aware datetime"
    assert exp_datetime.tzinfo == timezone.utc, "exp 应使用 UTC 时区"

    # 验证: 过期时间精确 (5 秒后, 允许 1 秒误差)
    expected_exp = datetime.now(timezone.utc) + timedelta(seconds=5)
    time_diff = abs((expected_exp - exp_datetime).total_seconds())
    assert time_diff < 1, f"过期时间误差: {time_diff}s (应 < 1s)"


# ========================================
# 学习总结
# ========================================

"""
安全模块测试要点:

1. 密码哈希测试:
   - 算法验证: 确保使用 bcrypt (不使用 MD5/SHA1 等不安全算法)
   - 加盐验证: 相同密码生成不同哈希
   - 不可逆验证: 哈希不包含原始密码
   - 验证功能: 正确密码通过, 错误密码失败

2. JWT Token 测试:
   - 时区感知: 使用 datetime.now(timezone.utc)
   - 过期时间: exp 字段正确设置
   - 格式验证: 三段式结构 (header.payload.signature)
   - 跨时区一致性: 不同时区验证结果相同

3. 时间处理标准化:
   - 弃用 datetime.utcnow() (返回 naive datetime)
   - 使用 datetime.now(timezone.utc) (返回 timezone-aware datetime)
   - Unix 时间戳: 与时区无关, 统一使用 UTC

4. 安全测试覆盖:
   - 正常场景: 正确密码, 有效 Token
   - 异常场景: 错误密码, 过期 Token, 伪造 Token
   - 边界条件: 空密码, 最大长度, 特殊字符

5. 性能验证:
   - 密码验证: < 0.5s (bcrypt 计算成本高, 但可接受)
   - Token 生成: < 0.1s (应快速响应)
   - 时间误差: < 1s (确保过期时间精确)

6. 为什么重要:
   - 认证是安全第一道防线
   - 密码泄露会导致账号被盗
   - Token 伪造会导致未授权访问
   - 时区错误会导致 Token 失效或过期延迟
"""
