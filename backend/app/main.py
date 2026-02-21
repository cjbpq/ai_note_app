from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
import os
from pathlib import Path
import sys

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.exceptions import ServiceError
from app.core.logging_config import setup_logging
from app.database import Base, engine
from app import models  # noqa: F401

logger = logging.getLogger(__name__)


def _patch_uvicorn_stdin_handling() -> None:
    if os.name != "nt":
        return

    try:  # pragma: no cover - uvicorn internals
        import uvicorn._subprocess as uvicorn_subprocess  # type: ignore
    except Exception:  # noqa: BLE001
        return

    if getattr(uvicorn_subprocess, "_stdin_patch_installed", False):
        return

    original_target = uvicorn_subprocess.subprocess_started

    def safe_subprocess_started(config, target, sockets, stdin_fileno):  # type: ignore[no-untyped-def]
        if stdin_fileno is not None:
            try:
                sys.stdin = os.fdopen(stdin_fileno)
            except OSError:
                logging.getLogger(__name__).warning(
                    "Uvicorn reload 子进程无法重新附加 stdin，已使用备用句柄防止重启失败。"
                )
                fallback = getattr(sys, "__stdin__", None)
                if fallback is not None:
                    sys.stdin = fallback
                else:  # pragma: no cover
                    sys.stdin = open(os.devnull, "r")

        config.configure_logging()
        target(sockets=sockets)

    uvicorn_subprocess.subprocess_started = safe_subprocess_started  # type: ignore[assignment]
    uvicorn_subprocess._stdin_patch_installed = True  # type: ignore[attr-defined]
    return


_patch_uvicorn_stdin_handling()

# 确保静态目录存在
upload_dir = Path(settings.UPLOAD_DIR)
upload_dir.mkdir(parents=True, exist_ok=True)

app_description = getattr(settings, "APP_DESCRIPTION", settings.APP_NAME)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理

    学习要点:
    - FastAPI 0.93+ 推荐使用 lifespan context manager 替代 @app.on_event()
    - yield 前的代码在应用启动时执行 (相当于 startup 事件)
    - yield 后的代码在应用关闭时执行 (相当于 shutdown 事件)
    - 统一的资源管理模式, 避免事件回调的顺序问题
    - 支持依赖注入: 可以在 lifespan 中设置 app.state 全局状态

    为什么改:
    - @app.on_event("startup") 在 FastAPI 0.93+ 已弃用
    - lifespan 模式更符合 Python 上下文管理器的惯用法
    - 确保资源清理逻辑一定会执行 (即使启动失败)
    """
    # 启动逻辑
    setup_logging()  # 初始化日志系统 (必须在第一步)
    logger.info("应用启动, 初始化数据库...")
    Base.metadata.create_all(bind=engine)
    logger.info("数据库初始化完成")

    yield  # 应用运行期间

    # 关闭逻辑 (可选)
    logger.info("应用关闭, 清理资源...")


app = FastAPI(
    title=settings.APP_NAME,
    description=app_description,
    version=settings.APP_VERSION,
    lifespan=lifespan,  # 注册生命周期管理器
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

# 改前问题: CORS 配置过度开放 allow_origins=["*"], 允许任何域名跨域访问
# 为什么改: 限制为环境变量配置的白名单域名, 防止 CSRF 攻击
# 学习要点: CSRF 攻击场景 - 恶意网站 evil.com 上的 JavaScript 可以利用用户浏览器 cookies 调用本项目 API
# 最小权限原则: 仅允许已知的前端域名访问后端 API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),  # 从环境变量加载白名单 (逗号分隔)
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],  # 明确允许的 HTTP 方法
    allow_headers=["*"],  # 允许所有请求头 (或限制为常用头部如 Authorization, Content-Type)
)

app.mount("/static", StaticFiles(directory=str(upload_dir)), name="static")


# === 全局异常处理器 ===
# 学习要点:
# - @app.exception_handler 装饰器用于注册全局异常处理器
# - 捕获 ServiceError 及其子类 (DoubaoServiceUnavailable, NoteNotFoundError, DatabaseError)
# - 返回标准化的 JSON 错误响应格式
# - 自动记录异常日志 (配合日志系统)
#
# 为什么这么改:
# 1. 统一错误格式: 所有业务异常返回相同的 JSON 结构, 前端可统一处理
# 2. 减少重复代码: 端点中无需 try-except 捕获业务异常, 直接抛出即可
# 3. 便于调试: 在一个地方记录所有异常日志, 方便问题排查
@app.exception_handler(ServiceError)
async def service_error_handler(request: Request, exc: ServiceError):
    """业务异常统一处理

    响应格式:
    {
        "error": "DoubaoServiceUnavailable",  # 异常类名
        "detail": "Doubao 服务未配置: 缺少 API Key",  # 错误详情
        "timestamp": "2025-11-18T10:30:00.123456+00:00"  # ISO 8601 时间戳
    }
    """
    logger.error(
        f"Service error occurred: {exc.__class__.__name__}",
        extra={
            "error_class": exc.__class__.__name__,
            "detail": exc.detail,
            "status_code": exc.status_code,
            "path": request.url.path,
            "method": request.method,
        },
        exc_info=True,  # 打印完整堆栈信息
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.__class__.__name__,
            "detail": exc.detail,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    """健康检查端点"""
    return {
        "message": f"欢迎使用 {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "timestamp": datetime.now().isoformat(),
    }
