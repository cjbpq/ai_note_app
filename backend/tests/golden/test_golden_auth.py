"""黄金文件测试: 认证相关 API
学习要点:
- 黄金测试验证 API 响应格式不变 (重构保护)
- 排除动态字段 (access_token, expires_in) 确保对比有效
- 固定测试账号确保结果可重复
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


@pytest.mark.golden
def test_golden_login_success(golden_assert):
    """黄金测试: 登录成功响应格式

    验证重点:
    - 响应状态码 200
    - 响应字段: access_token, token_type, expires_in
    - 字段类型和格式不变

    学习要点:
    - 排除 access_token: 每次生成的 JWT token 不同
    - 排除 expires_in: 可能因时间精度不同略有差异
    - 保留 token_type: 应始终为 "bearer"
    """
    response = client.post("/api/v1/auth/login", json={
        "username": "testuser",
        "password": "TestPassword123"
    })

    assert response.status_code == 200

    # 黄金断言: 对比响应格式 (排除动态字段)
    golden_assert(
        "auth_login_success",
        response.json(),
        exclude_keys=["access_token"]  # JWT token 每次不同
    )


@pytest.mark.golden
def test_golden_register_response(golden_assert):
    """黄金测试: 用户注册响应格式

    验证重点:
    - 响应状态码 201
    - 响应字段: id, username, email, message
    - 字段格式和类型不变

    学习要点:
    - 排除 id: 每次注册生成的 UUID 不同
    - 使用唯一用户名避免重复注册错误
    """
    # 使用时间戳生成唯一用户名
    import time
    unique_username = f"newuser_{int(time.time())}"

    response = client.post("/api/v1/auth/register", json={
        "username": unique_username,
        "email": f"{unique_username}@example.com",
        "password": "NewPassword123"
    })

    assert response.status_code == 201

    # 黄金断言
    golden_assert(
        "auth_register_response",
        response.json(),
        exclude_keys=["id", "username", "email"]  # 动态字段
    )
