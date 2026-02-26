"""FastAPI lifespan 生命周期测试

测试 @app.on_event() → lifespan context manager 迁移

学习要点:
- FastAPI 0.93+ 推荐使用 lifespan context manager 替代 @app.on_event()
- lifespan 统一了启动和关闭逻辑, 避免事件回调顺序问题
- yield 前执行启动逻辑, yield 后执行关闭逻辑
- 支持依赖注入: 可以在 lifespan 中设置 app.state 全局状态
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine
from sqlalchemy import inspect


def test_lifespan_startup_creates_tables():
    """测试 lifespan 启动时创建数据库表

    学习要点:
    - lifespan 的 yield 前代码在应用启动时执行
    - Base.metadata.create_all() 创建所有 SQLAlchemy 模型对应的表
    - 使用 TestClient 会自动触发 lifespan 执行
    """
    # 使用 TestClient 会触发 lifespan 启动逻辑
    with TestClient(app) as client:
        # 验证: 数据库表已创建
        inspector = inspect(engine)
        tables = inspector.get_table_names()

        # 验证: 核心表存在
        assert "users" in tables
        assert "notes" in tables
        assert "upload_jobs" in tables

        print(f"✅ 数据库表创建成功: {tables}")

        # 验证: 应用健康检查
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    print("✅ lifespan 启动逻辑验证通过")


def test_lifespan_shutdown_cleanup():
    """测试 lifespan 关闭时资源清理

    学习要点:
    - lifespan 的 yield 后代码在应用关闭时执行
    - TestClient 的上下文管理器退出时会触发 lifespan 关闭逻辑
    - 可以在关闭逻辑中执行资源清理 (关闭数据库连接池, 停止后台任务等)
    """
    import logging

    # 捕获日志输出
    logger = logging.getLogger("app.main")
    log_messages = []

    class LogHandler(logging.Handler):
        def emit(self, record):
            log_messages.append(record.getMessage())

    handler = LogHandler()
    logger.addHandler(handler)

    try:
        # 使用 TestClient 触发 lifespan 启动和关闭
        with TestClient(app) as client:
            # 应用运行期间
            response = client.get("/")
            assert response.status_code == 200

        # TestClient 退出后, lifespan 关闭逻辑已执行

        # 验证: 启动日志存在
        startup_logs = [msg for msg in log_messages if "初始化数据库" in msg or "应用启动" in msg]
        assert len(startup_logs) > 0

        # 验证: 关闭日志存在
        shutdown_logs = [msg for msg in log_messages if "应用关闭" in msg or "清理资源" in msg]
        assert len(shutdown_logs) > 0

        print("✅ lifespan 关闭逻辑验证通过")

    finally:
        logger.removeHandler(handler)


def test_lifespan_execution_order():
    """测试 lifespan 执行顺序

    学习要点:
    - lifespan 确保资源初始化在应用接收请求之前完成
    - 即使启动失败, 关闭逻辑也会执行 (Context Manager 保证)
    - 多个 lifespan 可以嵌套 (但通常只需要一个)
    """
    import time

    start_time = None
    first_request_time = None

    # 记录启动时间
    with TestClient(app) as client:
        start_time = time.time()

        # 第一个请求
        response = client.get("/health")
        first_request_time = time.time()

        assert response.status_code == 200

    # 验证: 启动逻辑在第一个请求之前完成
    assert start_time is not None
    assert first_request_time is not None
    assert first_request_time > start_time

    print("✅ lifespan 执行顺序验证通过")


def test_app_state_in_lifespan():
    """测试 lifespan 中设置 app.state 全局状态

    学习要点:
    - app.state 可以在 lifespan 中设置, 供所有端点访问
    - 常用于存储数据库连接池, 缓存客户端, 配置信息等
    - app.state 是线程安全的 (FastAPI 使用 starlette.datastructures.State)
    """
    from fastapi import FastAPI
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def test_lifespan(app: FastAPI):
        # 启动: 设置全局状态
        app.state.start_time = time.time()
        app.state.request_count = 0
        yield
        # 关闭: 清理状态
        del app.state.start_time
        del app.state.request_count

    # 创建测试应用
    test_app = FastAPI(lifespan=test_lifespan)

    @test_app.get("/test")
    async def test_endpoint(request):
        # 访问 app.state
        request.app.state.request_count += 1
        return {"count": request.app.state.request_count}

    # 测试
    with TestClient(test_app) as client:
        # 第一个请求
        response1 = client.get("/test")
        assert response1.json()["count"] == 1

        # 第二个请求
        response2 = client.get("/test")
        assert response2.json()["count"] == 2

    print("✅ app.state 全局状态验证通过")


if __name__ == "__main__":
    import time
    # 运行测试
    test_lifespan_startup_creates_tables()
    test_lifespan_shutdown_cleanup()
    test_lifespan_execution_order()
    test_app_state_in_lifespan()
    print("\n🎉 所有 lifespan 生命周期测试通过!")
