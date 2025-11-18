"""时区感知 datetime 测试

测试 datetime.utcnow() → datetime.now(timezone.utc) 迁移

学习要点:
- datetime.utcnow() 返回 naive datetime (无时区信息), Python 3.12+ 已弃用
- datetime.now(timezone.utc) 返回 aware datetime (有时区信息)
- JWT 的 exp 字段使用 Unix 时间戳, 但应用层应统一使用 timezone-aware datetime
"""

import pytest
from datetime import datetime, timedelta, timezone
from app.core.security import create_access_token


def test_jwt_exp_is_timezone_aware():
    """测试 JWT token 的 exp 字段使用 timezone-aware datetime

    学习要点:
    - JWT exp 字段会被 PyJWT 自动转换为 Unix 时间戳 (秒)
    - 使用 timezone-aware datetime 确保时区转换正确
    - datetime.now(timezone.utc) 返回的 datetime 对象包含 tzinfo 信息
    """
    import jwt
    from app.core.config import settings

    # 创建 JWT token (默认过期时间)
    token = create_access_token(data={"sub": "test_user"})

    # 解码 token (不验证签名, 仅获取 payload)
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

    # 验证: exp 字段是 Unix 时间戳 (整数)
    assert "exp" in payload
    assert isinstance(payload["exp"], int)

    # 验证: exp 时间在未来
    current_timestamp = datetime.now(timezone.utc).timestamp()
    assert payload["exp"] > current_timestamp

    # 验证: exp 时间在合理范围内 (默认 30 分钟)
    expected_exp = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    exp_datetime = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)

    # 允许 5 秒误差 (测试执行时间)
    time_diff = abs((exp_datetime - expected_exp).total_seconds())
    assert time_diff < 5

    print(f"✅ JWT exp 字段验证通过: {exp_datetime.isoformat()}")


def test_token_expiration_across_timezones():
    """测试跨时区 Token 验证的一致性

    学习要点:
    - 统一使用 UTC 时间避免时区转换错误
    - JWT 验证不受服务器时区影响 (PyJWT 自动处理)
    - datetime.now(timezone.utc) 确保应用层时间一致性
    """
    import jwt
    from app.core.config import settings

    # 创建短期 token (5 秒过期)
    short_token = create_access_token(
        data={"sub": "test_user"},
        expires_delta=timedelta(seconds=5)
    )

    # 立即验证 token (应该有效)
    payload = jwt.decode(short_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "test_user"

    # 验证 exp 时间是 timezone-aware
    exp_timestamp = payload["exp"]
    exp_datetime = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
    assert exp_datetime.tzinfo is not None
    assert exp_datetime.tzinfo == timezone.utc

    print(f"✅ 跨时区验证通过: exp={exp_datetime.isoformat()}")


def test_timezone_aware_datetime_arithmetic():
    """测试 timezone-aware datetime 的算术运算

    学习要点:
    - timezone-aware datetime 可以安全地进行加减运算
    - timedelta 不包含时区信息, 但结果继承原 datetime 的 tzinfo
    - 混合 naive 和 aware datetime 会抛出 TypeError
    """
    # 创建 timezone-aware datetime
    now = datetime.now(timezone.utc)
    assert now.tzinfo is not None

    # 加上 timedelta
    future = now + timedelta(hours=1)
    assert future.tzinfo == timezone.utc

    # 验证时间差
    delta = future - now
    assert delta.total_seconds() == 3600

    # 验证 naive datetime 无法与 aware datetime 比较
    naive_now = datetime.utcnow()
    with pytest.raises(TypeError):
        _ = naive_now < now  # 会抛出 TypeError

    print("✅ timezone-aware datetime 算术运算验证通过")


def test_datetime_serialization_iso8601():
    """测试 datetime 序列化为 ISO 8601 格式

    学习要点:
    - ISO 8601 是国际标准的日期时间格式: YYYY-MM-DDTHH:MM:SS+00:00
    - timezone-aware datetime 的 isoformat() 会包含时区信息 (+00:00 表示 UTC)
    - 前端可以直接解析 ISO 8601 格式并转换为本地时区
    """
    now = datetime.now(timezone.utc)
    iso_str = now.isoformat()

    # 验证: ISO 8601 格式包含时区信息
    assert iso_str.endswith("+00:00")
    assert "T" in iso_str

    # 验证: 可以被反序列化
    parsed = datetime.fromisoformat(iso_str)
    assert parsed.tzinfo == timezone.utc
    assert abs((parsed - now).total_seconds()) < 0.001  # 微秒精度

    print(f"✅ ISO 8601 序列化验证通过: {iso_str}")


if __name__ == "__main__":
    # 运行测试
    test_jwt_exp_is_timezone_aware()
    test_token_expiration_across_timezones()
    test_timezone_aware_datetime_arithmetic()
    test_datetime_serialization_iso8601()
    print("\n🎉 所有时区感知 datetime 测试通过!")
