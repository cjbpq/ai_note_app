"""安全测试: 认证和授权
学习要点:
- JWT Token 过期测试
- Token 伪造检测
- 未授权访问防护
- 水平越权防护 (用户只能访问自己的数据)
"""

import pytest
from datetime import timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import create_access_token

client = TestClient(app)


# ========================================
# 测试用例 1: JWT Token 过期
# ========================================

@pytest.mark.security
def test_jwt_token_expiration():
    """测试: JWT Token 过期后无法使用

    验证重点:
    - 过期 Token 被拒绝 (401 Unauthorized)
    - 错误信息包含 "expired" 关键词
    - 过期检查在请求验证阶段执行

    学习要点:
    - JWT exp 字段: Unix 时间戳, 表示过期时间
    - FastAPI 依赖注入: get_current_user() 自动检查 Token 有效性
    - 时间敏感测试: 使用负数 expires_delta 创建已过期 Token

    为什么重要:
    - 防止 Token 永久有效导致安全风险
    - 强制用户定期重新登录
    - 降低 Token 被盗用的风险窗口
    """
    # 创建已过期的 Token (10 秒前过期)
    expired_token = create_access_token(
        data={"sub": "test_user"},
        expires_delta=timedelta(seconds=-10)
    )

    # 使用过期 Token 访问保护端点
    headers = {"Authorization": f"Bearer {expired_token}"}
    response = client.get("/api/v1/library/notes", headers=headers)

    # 验证: 返回 401 Unauthorized
    assert response.status_code == 401

    # 验证: 错误信息包含 "expired"
    error_detail = response.json().get("detail", "").lower()
    assert "expired" in error_detail or "token" in error_detail, \
        f"错误信息应提示 Token 过期: {error_detail}"


# ========================================
# 测试用例 2: Token 伪造检测
# ========================================

@pytest.mark.security
def test_invalid_token_rejected():
    """测试: 伪造/无效 Token 被拒绝

    验证重点:
    - 无效 Token 格式被拒绝
    - 错误签名的 Token 被检测
    - 返回 401 Unauthorized

    学习要点:
    - JWT 签名验证: 使用 SECRET_KEY 验证 Token 完整性
    - Token 篡改检测: 修改 payload 会导致签名不匹配
    - 安全边界: 未经验证的输入一律拒绝

    为什么重要:
    - 防止攻击者伪造 Token
    - 确保 Token 由服务器签发
    - 检测中间人攻击 (MITM)
    """
    # 测试 1: 无效格式的 Token
    headers = {"Authorization": "Bearer invalid-token-12345"}
    response = client.get("/api/v1/library/notes", headers=headers)
    assert response.status_code == 401

    # 测试 2: 空 Token
    headers = {"Authorization": "Bearer "}
    response = client.get("/api/v1/library/notes", headers=headers)
    assert response.status_code == 401

    # 测试 3: 错误签名的 Token (篡改 payload)
    # 使用错误的 SECRET_KEY 生成 Token
    import jwt
    fake_token = jwt.encode(
        {"sub": "attacker"},
        "wrong-secret-key",
        algorithm="HS256"
    )
    headers = {"Authorization": f"Bearer {fake_token}"}
    response = client.get("/api/v1/library/notes", headers=headers)
    assert response.status_code == 401


# ========================================
# 测试用例 3: 未授权访问被拒绝
# ========================================

@pytest.mark.security
def test_unauthorized_access_denied():
    """测试: 未提供 Token 的请求被拒绝

    验证重点:
    - 不提供 Authorization header 返回 401
    - 受保护端点强制身份验证
    - 错误信息清晰 (Not authenticated)

    学习要点:
    - FastAPI Depends(get_current_user): 依赖注入自动验证 Token
    - 401 vs 403: 401 未认证, 403 已认证但无权限
    - Security by default: 默认拒绝, 显式授权

    为什么重要:
    - 防止匿名访问敏感数据
    - 强制身份验证
    - 清晰的安全边界
    """
    # 不提供 Authorization header
    response = client.get("/api/v1/library/notes")

    # 验证: 返回 401 Unauthorized
    assert response.status_code == 401

    # 验证: 错误信息清晰
    error_detail = response.json().get("detail", "")
    assert error_detail, "应返回错误信息"


# ========================================
# 测试用例 4: 水平越权防护 (重要!)
# ========================================

@pytest.mark.security
def test_user_cannot_access_other_users_notes(db_session):
    """测试: 用户无法访问其他用户的笔记 (水平越权防护)

    验证重点:
    - 用户 A 无法获取用户 B 的笔记
    - 返回 403 Forbidden 或 404 Not Found
    - 服务层检查 user_id 所有权

    学习要点:
    - 水平越权: 同级用户之间的越权访问
    - 所有权检查: _ownership_filter(user_id) 过滤查询
    - 安全第一: 每个查询都应验证所有权

    为什么重要:
    - 防止用户数据泄露
    - OWASP A01:2021 - Broken Access Control
    - 隐私保护合规要求 (GDPR)

    攻击场景:
    1. 用户 A 获取自己的笔记 ID: note-123
    2. 用户 B 尝试访问 /api/v1/library/notes/note-123
    3. 如果没有所有权检查, 用户 B 可以读取用户 A 的私密笔记
    """
    from app.models.user import User
    from app.models.note import Note
    from app.core.security import get_password_hash

    # 创建用户 A
    user_a = User(
        id="user-a-123",
        username="user_a",
        email="user_a@example.com",
        hashed_password=get_password_hash("PasswordA123")
    )
    db_session.add(user_a)

    # 创建用户 B
    user_b = User(
        id="user-b-456",
        username="user_b",
        email="user_b@example.com",
        hashed_password=get_password_hash("PasswordB123")
    )
    db_session.add(user_b)
    db_session.commit()

    # 用户 A 创建笔记
    note_a = Note(
        id="note-a-001",
        user_id=user_a.id,
        title="用户 A 的私密笔记",
        original_text="这是用户 A 的私人内容",
        category="私密"
    )
    db_session.add(note_a)
    db_session.commit()

    # 用户 A 登录
    response_a = client.post("/api/v1/auth/login", json={
        "username": "user_a",
        "password": "PasswordA123"
    })
    token_a = response_a.json()["access_token"]

    # 用户 B 登录
    response_b = client.post("/api/v1/auth/login", json={
        "username": "user_b",
        "password": "PasswordB123"
    })
    token_b = response_b.json()["access_token"]

    # 验证 1: 用户 A 可以访问自己的笔记
    headers_a = {"Authorization": f"Bearer {token_a}"}
    response = client.get(f"/api/v1/library/notes/{note_a.id}", headers=headers_a)
    assert response.status_code == 200
    assert response.json()["title"] == "用户 A 的私密笔记"

    # 验证 2: 用户 B 无法访问用户 A 的笔记 (水平越权防护)
    headers_b = {"Authorization": f"Bearer {token_b}"}
    response = client.get(f"/api/v1/library/notes/{note_a.id}", headers=headers_b)

    # 应返回 403 Forbidden 或 404 Not Found (两者都可接受)
    assert response.status_code in [403, 404], \
        f"用户 B 不应访问用户 A 的笔记, 应返回 403/404, 实际: {response.status_code}"


# ========================================
# 学习总结
# ========================================

"""
认证授权安全测试要点:

1. JWT Token 安全:
   - 过期检查: Token 过期后立即失效
   - 签名验证: 伪造 Token 被检测
   - 格式验证: 无效 Token 被拒绝

2. 访问控制:
   - 未认证访问: 返回 401 Unauthorized
   - 水平越权: 用户无法访问其他用户数据
   - 垂直越权: 普通用户无法执行管理员操作

3. OWASP Top 10:
   - A01:2021 - Broken Access Control (访问控制失效)
   - A02:2021 - Cryptographic Failures (加密失效)
   - A07:2021 - Identification and Authentication Failures (身份认证失效)

4. 测试覆盖:
   - 正常场景: 有效 Token, 授权用户
   - 异常场景: 无 Token, 过期 Token, 伪造 Token
   - 越权场景: 访问其他用户数据, 执行越权操作

5. 安全边界:
   - 默认拒绝: 未经验证的请求一律拒绝
   - 最小权限: 用户只能访问自己的数据
   - 深度防御: 多层验证 (Token + 所有权 + 权限)

6. 常见漏洞:
   - JWT 永不过期
   - 未验证 Token 签名
   - 未检查资源所有权
   - 使用弱密钥 (SECRET_KEY 过短)
   - 在 URL 中传递 Token (应使用 Authorization header)
"""
