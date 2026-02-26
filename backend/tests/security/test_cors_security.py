"""测试 CORS 配置安全性

验证 CORS 限制为白名单域名, 拒绝非法 Origin
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_cors_rejects_unknown_origin():
    """验证 CORS 拒绝非白名单域名的请求

    改前风险: allow_origins=["*"] 允许任何域名访问
    改后行为: 仅允许白名单域名 (ALLOWED_ORIGINS 环境变量)
    CSRF 攻击场景: 恶意网站 evil.com 尝试调用 API 应被拒绝
    """
    # 模拟来自恶意网站的跨域请求
    headers = {
        "Origin": "https://evil.com",
        "Access-Control-Request-Method": "POST",
    }

    # OPTIONS 预检请求 (CORS preflight)
    response = client.options("/api/v1/library/notes", headers=headers)

    # 验证响应头
    # 注意: 当 Origin 不在白名单时, FastAPI 不会返回 Access-Control-Allow-Origin
    # 或者返回的值不包含 evil.com
    allow_origin = response.headers.get("Access-Control-Allow-Origin", "")

    # 验证: evil.com 不在允许的 Origin 中
    assert "evil.com" not in allow_origin


def test_cors_allows_whitelisted_origin():
    """验证 CORS 允许白名单域名的请求

    预期行为: localhost:3000 和 localhost:5173 在默认白名单中
    """
    # 测试默认白名单中的域名
    whitelisted_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    for origin in whitelisted_origins:
        headers = {
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        }

        response = client.options("/api/v1/library/notes", headers=headers)

        # 验证 CORS 响应头
        allow_origin = response.headers.get("Access-Control-Allow-Origin", "")

        # 白名单域名应被允许
        assert origin in allow_origin or allow_origin == origin, f"Origin {origin} 应在白名单中"


def test_cors_methods_limited():
    """验证 CORS 仅允许必要的 HTTP 方法

    改前风险: allow_methods=["*"] 允许所有 HTTP 方法
    改后行为: 仅允许 GET, POST, PUT, PATCH, DELETE
    """
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "GET",
    }

    response = client.options("/api/v1/library/notes", headers=headers)

    # 获取允许的方法
    allow_methods = response.headers.get("Access-Control-Allow-Methods", "")

    # 验证仅包含必要的方法
    expected_methods = ["GET", "POST", "PUT", "PATCH", "DELETE"]
    for method in expected_methods:
        assert method in allow_methods, f"{method} 应在允许的方法中"

    # 验证不包含危险方法 (如 TRACE, CONNECT)
    dangerous_methods = ["TRACE", "CONNECT"]
    for method in dangerous_methods:
        assert method not in allow_methods, f"{method} 不应在允许的方法中"
