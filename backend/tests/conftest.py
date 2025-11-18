"""pytest 全局配置和共享 fixtures
学习要点:
- conftest.py: pytest 自动加载的配置文件, 定义可复用的 fixtures
- fixture 作用域: function (每个测试用例), session (整个测试会话)
- 依赖注入: pytest 自动根据参数名匹配并注入 fixture
"""

import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

from app.database import Base
from app.main import app
from app.core.config import settings


# ========================================
# 数据库 Fixtures
# ========================================

@pytest.fixture(scope="function")
def db_session() -> Session:
    """为每个测试用例创建独立的内存数据库会话

    学习要点:
    - scope="function": 每个测试用例都会创建新的数据库 (完全隔离)
    - sqlite:///:memory:: 内存数据库, 速度快, 测试结束自动销毁
    - yield: 提供 session 给测试用例, 测试结束后执行清理逻辑

    为什么改:
    - 避免测试用例之间数据污染
    - 内存数据库比文件数据库快 10 倍以上
    - 自动清理, 无需手动删除测试数据
    """
    # 创建内存数据库引擎
    engine = create_engine("sqlite:///:memory:", echo=False)

    # 创建所有数据库表 (基于 SQLAlchemy models)
    Base.metadata.create_all(bind=engine)

    # 创建会话工厂
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    # 提供 session 给测试用例
    yield session

    # 清理逻辑 (测试结束后执行)
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user(db_session: Session):
    """创建测试用户

    学习要点:
    - fixture 依赖注入: test_user 依赖 db_session (pytest 自动解析)
    - 固定测试数据: 确保测试可重复性
    - 返回值: 测试用例可直接使用 test_user 对象
    """
    from app.models.user import User
    from app.core.security import get_password_hash

    user = User(
        id="test-user-123",
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("TestPassword123")
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    return user


# ========================================
# HTTP 客户端 Fixtures
# ========================================

@pytest.fixture
def test_client():
    """创建 FastAPI 测试客户端

    学习要点:
    - TestClient: FastAPI 内置测试工具, 模拟 HTTP 请求
    - with 语句: 确保客户端资源正确清理
    - 用法: client.get("/api/v1/endpoint") 模拟 GET 请求
    """
    with TestClient(app) as client:
        yield client


@pytest.fixture
def auth_token(test_client, test_user):
    """获取认证 Token (用于受保护端点测试)

    学习要点:
    - fixture 组合: 同时依赖 test_client 和 test_user
    - 认证流程: 登录 → 获取 access_token
    - 返回值: 测试用例可直接使用 token 字符串
    """
    # 登录获取 Token
    response = test_client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "TestPassword123"}
    )
    assert response.status_code == 200

    return response.json()["access_token"]


# ========================================
# Mock 外部服务 Fixtures
# ========================================

@pytest.fixture
def mock_doubao_service(monkeypatch):
    """Mock Doubao AI 服务 (避免真实 API 调用)

    学习要点:
    - monkeypatch: pytest 内置工具, 临时替换模块/函数
    - Mock 外部依赖: 隔离测试, 提高速度, 避免依赖外部服务
    - 固定返回值: 确保测试可重复性

    为什么改:
    - 避免测试依赖真实 Doubao API (费用, 速度, 可用性)
    - 模拟各种场景 (成功, 失败, 超时) 更容易
    - 测试速度提升 100 倍以上
    """
    from app.services import doubao_service

    class MockDoubaoService:
        is_available = True

        @staticmethod
        def availability_status():
            return True, None

        @staticmethod
        def generate_structured_note(*args, **kwargs):
            return {
                "note": {
                    "title": "Mock 笔记标题",
                    "summary": "Mock 摘要内容",
                    "raw_text": "Mock 原始文本",
                    "category": "学习笔记"
                }
            }

    # 替换真实 doubao_service 模块
    monkeypatch.setattr("app.services.doubao_service", MockDoubaoService())

    return MockDoubaoService()


# ========================================
# 环境变量 Fixtures
# ========================================

@pytest.fixture(scope="session", autouse=True)
def setup_test_env():
    """设置测试环境变量 (自动执行, 整个测试会话生效)

    学习要点:
    - autouse=True: 自动执行, 无需显式依赖
    - scope="session": 整个测试会话只执行一次
    - 环境变量: 确保测试环境配置正确
    """
    os.environ["SECRET_KEY"] = "test-secret-key-with-sufficient-length-32-bytes-minimum-requirement"
    os.environ["ALLOWED_ORIGINS"] = "http://localhost:3000,http://localhost:5173"
    os.environ["DATABASE_URL"] = "sqlite:///:memory:"
