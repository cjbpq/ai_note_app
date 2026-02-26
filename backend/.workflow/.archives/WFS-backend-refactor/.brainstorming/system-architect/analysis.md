# 系统架构师分析：Backend 系统化重构

**元数据**:
- 会话ID: WFS-backend-refactor
- 角色: system-architect
- 分析时间: 2025-11-18
- 框架参考: @../guidance-specification.md

---

## 一、架构概览与问题诊断

### 1.1 系统定位

**当前系统**：基于 FastAPI 的 AI 笔记应用后端，提供图像识别、笔记管理、用户认证等核心功能。

**技术栈**：
- 框架：FastAPI 0.104.1 + Pydantic v2
- 数据库：SQLite (SQLAlchemy ORM)
- 异步运行时：Uvicorn
- AI 服务：Doubao Vision API (火山引擎)
- 认证：JWT (PyJWT + bcrypt)

**架构模式**：采用经典的分层架构
```
API Layer (endpoints/)
  ↓
Service Layer (services/)
  ↓
Data Layer (models/ + database.py)
```

### 1.2 核心架构问题汇总

根据代码分析，我识别出以下**16个架构级问题**（按严重程度排序）：

#### 🔴 严重问题（3个）- 影响安全性和稳定性

**P0-1: 硬编码的密钥暴露安全风险**
- **位置**：`app/core/config.py:23`
- **问题**：`SECRET_KEY = "your-secret-key-change-in-production"` 硬编码在代码中
- **影响**：JWT 令牌可被伪造，用户认证体系完全失效
- **新手解释**：SECRET_KEY 就像你家的钥匙，硬编码相当于把钥匙刻在门上，任何人都能复制
- **架构改进**：
  ```python
  # 改前：硬编码默认值
  SECRET_KEY: str = "your-secret-key-change-in-production"

  # 改后：强制从环境变量读取，无默认值
  SECRET_KEY: str = Field(..., validation_alias="SECRET_KEY")

  # 启动检查：在 app/main.py 添加
  @asynccontextmanager
  async def lifespan(app: FastAPI):
      if settings.SECRET_KEY == "your-secret-key-change-in-production":
          raise RuntimeError("SECURITY: SECRET_KEY must be set in .env file")
      yield
  ```

**P0-2: 不安全的异步任务管理**
- **位置**：`app/api/v1/endpoints/library.py:97`
- **问题**：使用 `asyncio.create_task()` 无异常捕获，任务失败会静默丢失
- **影响**：用户上传图片后任务失败，但 API 返回成功，导致数据不一致
- **新手解释**：`create_task` 就像把任务扔进后台，如果任务失败了，没人知道发生了什么
- **架构改进**：使用 FastAPI BackgroundTasks（框架内置，自动异常处理）
  ```python
  # 改前：手动创建任务，无异常处理
  asyncio.create_task(process_note_job(...))

  # 改后：使用 FastAPI BackgroundTasks
  from fastapi import BackgroundTasks

  async def create_note_from_image(
      background_tasks: BackgroundTasks,  # 注入依赖
      ...
  ):
      background_tasks.add_task(process_note_job, ...)  # 自动异常捕获
  ```

**P0-3: 时区感知缺失导致时间计算错误**
- **位置**：`app/core/security.py:11,13`
- **问题**：使用已弃用的 `datetime.utcnow()`，返回 naive datetime（无时区信息）
- **影响**：跨时区场景下 JWT 过期时间计算错误，token 可能提前/延后过期
- **新手解释**：`utcnow()` 不带时区标记，就像说"3点见面"没说是北京时间还是纽约时间
- **架构改进**：
  ```python
  # 改前：Python 3.12 已弃用
  from datetime import datetime, timedelta
  expire = datetime.utcnow() + timedelta(minutes=15)

  # 改后：使用 timezone-aware datetime
  from datetime import datetime, timedelta, timezone
  expire = datetime.now(timezone.utc) + timedelta(minutes=15)
  # timezone.utc 明确标记这是 UTC 时区
  ```

#### 🟠 高优先级问题（5个）- 影响可维护性和扩展性

**P1-1: 缺少全局异常处理架构**
- **位置**：整个项目无统一异常处理器
- **问题**：各处使用 `except Exception` 或 `except Exception as exc: # noqa: BLE001`，错误信息不一致
- **影响**：调试困难，前端无法统一处理错误响应
- **架构设计**：建立三层异常体系
  ```python
  # 新增 app/core/exceptions.py
  class ServiceError(Exception):
      """业务逻辑错误基类"""
      def __init__(self, message: str, code: str = "SERVICE_ERROR"):
          self.message = message
          self.code = code

  class DatabaseError(ServiceError):
      """数据库操作错误"""
      code = "DATABASE_ERROR"

  class ExternalServiceError(ServiceError):
      """外部服务错误（如 Doubao API）"""
      code = "EXTERNAL_SERVICE_ERROR"

  # app/main.py 注册全局处理器
  @app.exception_handler(ServiceError)
  async def service_error_handler(request: Request, exc: ServiceError):
      return JSONResponse(
          status_code=500,
          content={
              "error": exc.code,
              "message": exc.message,
              "timestamp": datetime.now(timezone.utc).isoformat()
          }
      )
  ```

**P1-2: 已弃用的应用生命周期管理**
- **位置**：`app/main.py:85-88`
- **问题**：使用 `@app.on_event("startup")` 已在 FastAPI 0.93+ 被弃用
- **影响**：未来版本可能移除该特性，且无法管理清理逻辑（shutdown）
- **新手解释**：`on_event` 就像旧式开关，新的 `lifespan` 是现代智能开关，能管理开和关
- **架构改进**：
  ```python
  # 改前：分散的事件处理
  @app.on_event("startup")
  async def on_startup():
      Base.metadata.create_all(bind=engine)
      ensure_sqlite_schema()

  # 改后：统一生命周期管理
  from contextlib import asynccontextmanager

  @asynccontextmanager
  async def lifespan(app: FastAPI):
      # 启动逻辑
      Base.metadata.create_all(bind=engine)
      ensure_sqlite_schema()
      logger.info("Application started")

      yield  # 应用运行

      # 清理逻辑（之前无法实现）
      logger.info("Application shutdown")
      # 可添加数据库连接关闭、缓存清理等

  app = FastAPI(lifespan=lifespan)  # 注册生命周期
  ```

**P1-3: Pydantic v2 不兼容代码**
- **位置**：`app/api/v1/endpoints/library.py:264`
- **问题**：使用 Pydantic v1 的 `.dict()` 方法，v2 已弃用
- **影响**：升级 Pydantic 版本会报错，且性能不如新方法
- **新手解释**：`.dict()` 是旧 API，`.model_dump()` 是新 API，功能相同但性能更好
- **架构改进**：
  ```python
  # 改前：Pydantic v1 API
  update_data = {k: v for k, v in note_update.dict().items() if v is not None}

  # 改后：Pydantic v2 API
  update_data = {k: v for k, v in note_update.model_dump().items() if v is not None}
  # exclude_unset=True 可替代手动过滤 None
  update_data = note_update.model_dump(exclude_unset=True)
  ```

**P1-4: 缺少结构化日志系统**
- **位置**：整个项目仅 `doubao_service.py` 有简单 logger
- **问题**：无统一日志配置，无法追踪请求链路、性能瓶颈
- **影响**：生产环境问题排查困难，无法进行性能分析
- **架构设计**：建立结构化日志体系
  ```python
  # 新增 app/core/logging_config.py
  import logging
  import json
  from datetime import datetime, timezone

  class JSONFormatter(logging.Formatter):
      """JSON 格式日志，便于日志分析工具处理"""
      def format(self, record):
          log_data = {
              "timestamp": datetime.now(timezone.utc).isoformat(),
              "level": record.levelname,
              "logger": record.name,
              "message": record.getMessage(),
              "module": record.module,
              "function": record.funcName,
          }
          if record.exc_info:
              log_data["exception"] = self.formatException(record.exc_info)
          return json.dumps(log_data, ensure_ascii=False)

  def setup_logging():
      """初始化日志配置"""
      handler = logging.StreamHandler()
      handler.setFormatter(JSONFormatter())

      logging.basicConfig(
          level=logging.INFO,
          handlers=[handler]
      )

  # app/main.py 启动时调用
  @asynccontextmanager
  async def lifespan(app: FastAPI):
      setup_logging()
      logger.info("Application started")
      yield
  ```

**P1-5: 数据库查询存在 SQL 注入风险**
- **位置**：`app/services/note_service.py:99`（虽然使用了 `.ilike()`，但架构上缺少统一安全审查）
- **问题**：虽然当前代码使用了 ORM 参数化查询，但缺少架构级安全约束
- **影响**：未来新增代码可能引入 SQL 注入漏洞
- **新手解释**：ORM 自动转义特殊字符，就像自动给用户输入加引号，防止恶意代码执行
- **架构约束**：
  ```python
  # 正确示例：使用 ORM filter（已在代码中）
  query.filter(Note.title.ilike(f"%{keyword}%"))  # ✅ ORM 自动转义

  # 错误示例：字符串拼接（需在 Code Review 中禁止）
  query = f"SELECT * FROM notes WHERE title LIKE '%{keyword}%'"  # ❌ SQL 注入风险

  # 架构建议：添加 pre-commit hook 检测不安全模式
  # 使用 bandit 扫描：bandit -r app/ -ll
  ```

#### 🟡 中等优先级问题（5个）- 影响代码质量

**P2-1: 代码重复 - doubao 可用性检查**
- **位置**：`library.py:75-81, 133-138` 等多处
- **问题**：相同的 `doubao_service.availability_status()` 检查逻辑重复 4+ 次
- **影响**：维护成本高，修改需要同步多处代码
- **架构改进**：使用 FastAPI Depends 依赖注入
  ```python
  # 新增 app/core/dependencies.py
  from fastapi import HTTPException

  async def check_doubao_available() -> None:
      """检查 Doubao 服务可用性（依赖注入）"""
      available, reason = doubao_service.availability_status()
      if not available:
          detail = f"Doubao 服务未配置：{reason}" if reason else "Doubao 服务未配置"
          raise HTTPException(status_code=500, detail=detail)

  # 端点中使用：声明依赖即可，无��重复代码
  @router.post("/notes/from-image", dependencies=[Depends(check_doubao_available)])
  async def create_note_from_image(...):
      # 此时 doubao 已确认可用，直接使用
      pass
  ```

**P2-2: 缺少 CORS 安全配置**
- **位置**：`app/main.py:70-76`
- **问题**：`allow_origins=["*"]` 允许所有来源，生产环境不安全
- **影响**：容易遭受 CSRF 攻击，任何网站都能调用你的 API
- **新手解释**：`allow_origins=["*"]` 就像把家门钥匙给所有人，应该只给信任的人（前端域名）
- **架构改进**：
  ```python
  # 改前：开发环境配置
  allow_origins=["*"]

  # 改后：环境感知配置
  # app/core/config.py 添加
  CORS_ORIGINS: List[str] = Field(
      default=["http://localhost:3000"],  # 开发环境默认
      validation_alias="CORS_ORIGINS"
  )

  # app/main.py 使用
  app.add_middleware(
      CORSMiddleware,
      allow_origins=settings.CORS_ORIGINS,  # 从配置读取
      allow_credentials=True,
      allow_methods=["GET", "POST", "PUT", "DELETE"],  # 限制方法
      allow_headers=["*"],
  )
  ```

**P2-3: 数据库迁移缺失**
- **位置**：`app/database.py:22-36` 手动修改 schema
- **问题**：使用 `ensure_sqlite_schema()` 手动 ALTER TABLE，无版本控制
- **影响**：无法回滚 schema 变更，团队协作时 schema 不一致
- **新手解释**：手动改表结构就像改房子结构没留图纸，出问题无法恢复
- **架构建议**：引入 Alembic 数据库迁移工具
  ```bash
  # 安装 Alembic
  pip install alembic

  # 初始化迁移环境
  alembic init alembic

  # 生成迁移文件（自动检测 model 变更）
  alembic revision --autogenerate -m "Add user_id column"

  # 执行迁移
  alembic upgrade head
  ```

**P2-4: 缺少健康检查端点**
- **位置**：`app/main.py:101-109` 仅有基础健康检查
- **问题**：健康检查不验证依赖服务（数据库、Doubao API）状态
- **影响**：容器健康检查可能误报，实际服务不可用
- **架构改进**：
  ```python
  @app.get("/health")
  async def health_check(db: Session = Depends(get_db)):
      """增强的健康检查"""
      health_status = {
          "status": "healthy",
          "app": settings.APP_NAME,
          "version": settings.APP_VERSION,
          "timestamp": datetime.now(timezone.utc).isoformat(),
          "checks": {}
      }

      # 检查数据库连接
      try:
          db.execute(text("SELECT 1"))
          health_status["checks"]["database"] = "ok"
      except Exception as e:
          health_status["status"] = "unhealthy"
          health_status["checks"]["database"] = f"error: {str(e)}"

      # 检查 Doubao 服务
      available, reason = doubao_service.availability_status()
      health_status["checks"]["doubao"] = "ok" if available else f"error: {reason}"

      status_code = 200 if health_status["status"] == "healthy" else 503
      return JSONResponse(content=health_status, status_code=status_code)
  ```

**P2-5: 缺少 API 版本策略**
- **位置**：`app/api/v1/` 虽有 v1 目录，但缺少版本管理机制
- **问题**：破坏性变更无法平滑迁移，强制所有客户端同步升级
- **影响**：无法支持多版本 API 共存，升级风险高
- **架构建议**：
  ```python
  # 当前架构：单版本
  app.include_router(api_router, prefix=settings.API_V1_STR)

  # 未来架构：多版本共存（重构后期考虑）
  from app.api.v1.api import api_router as v1_router
  from app.api.v2.api import api_router as v2_router

  app.include_router(v1_router, prefix="/api/v1")
  app.include_router(v2_router, prefix="/api/v2")

  # 客户端通过版本号选择 API
  # /api/v1/notes - 旧版本
  # /api/v2/notes - 新版本（可包含破坏性变更）
  ```

#### 🟢 低优先级问题（3个）- 优化建议

**P3-1: 缺少请求 ID 追踪**
- **问题**：无法关联单次请求的所有日志
- **影响**：分布式场景下问题排查困难
- **架构建议**：添加中间件注入 request_id
  ```python
  import uuid
  from starlette.middleware.base import BaseHTTPMiddleware

  class RequestIDMiddleware(BaseHTTPMiddleware):
      async def dispatch(self, request, call_next):
          request_id = str(uuid.uuid4())
          request.state.request_id = request_id
          response = await call_next(request)
          response.headers["X-Request-ID"] = request_id
          return response

  app.add_middleware(RequestIDMiddleware)
  ```

**P3-2: 缺少速率限制**
- **问题**：无 API 调用频率限制，易遭受滥用
- **影响**：恶意请求可能耗尽服务资源
- **架构建议**：引入 slowapi（FastAPI 限流库）
  ```python
  from slowapi import Limiter, _rate_limit_exceeded_handler
  from slowapi.util import get_remote_address

  limiter = Limiter(key_func=get_remote_address)
  app.state.limiter = limiter
  app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

  @router.post("/notes/from-image")
  @limiter.limit("10/minute")  # 每分钟最多 10 次
  async def create_note_from_image(...):
      pass
  ```

**P3-3: 缺少 API 文档版本控制**
- **问题**：OpenAPI 文档无版本历史，破坏性变更无记录
- **影响**：客户端无法知道 API 何时发生变更
- **架构建议**：导出 OpenAPI schema 到版本控制
  ```bash
  # 导出当前 API 文档
  curl http://localhost:8000/api/v1/openapi.json > docs/api-v1.0.0.json

  # 每次发布前更新版本号并提交
  git add docs/api-v1.0.0.json
  git commit -m "chore: update API documentation v1.0.0"
  ```

---

## 二、架构改进方案

### 2.1 核心架构设计

#### 异常处理架构（对应 P1-1）

**设计原则**：
- 业务层抛出领域异常（ServiceError 子类）
- 框架层转换为 HTTP 响应（全局异常处理器）
- 日志层记录完整上下文（结构化日志）

**���施步骤**：
```
1. 新增 app/core/exceptions.py（异常类定义）
2. 修改 app/main.py（注册全局异常处理器）
3. 修改 services/ 下所有文件（替换 Exception 为自定义异常）
4. 修改 endpoints/ 下所有文件（移除业务异常捕获，交给全局处理器）
```

**代码示例**：
```python
# app/services/doubao_service.py 改造
class DoubaoVisionService:
    def _ensure_client(self):
        if not self.is_available:
            # 改前：raise DoubaoServiceError(message)
            # 改后：使用统��异常类
            raise ExternalServiceError(
                message="Doubao SDK not installed or API key missing",
                code="DOUBAO_UNAVAILABLE"
            )

    def generate_structured_note(self, ...):
        try:
            response = client.responses.create(...)
        except Exception as exc:
            # 改前：logger.exception + raise DoubaoServiceError
            # 改后：包装为领域异常
            raise ExternalServiceError(
                message=f"Doubao request failed: {str(exc)}",
                code="DOUBAO_REQUEST_FAILED"
            ) from exc
```

#### 生命周期管理架构（对应 P1-2）

**设计原则**：
- 使用 FastAPI lifespan 管理应用生命周期
- 启动时检查配置和依赖
- 关闭时清理资源

**实施代码**：
```python
# app/main.py 完整改造
from contextlib import asynccontextmanager
import logging

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # === 启动阶段 ===
    logger.info("Application starting...")

    # 1. 验证配置
    if settings.SECRET_KEY == "your-secret-key-change-in-production":
        raise RuntimeError("SECURITY: SECRET_KEY must be set via environment variable")

    # 2. 初始化日志
    setup_logging()

    # 3. 初始化数据库
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_schema()
    logger.info("Database initialized")

    # 4. 检查外部服务
    available, reason = doubao_service.availability_status()
    if not available:
        logger.warning(f"Doubao service unavailable: {reason}")
    else:
        logger.info("Doubao service ready")

    logger.info("Application started successfully")

    # === 应用运行 ===
    yield

    # === 关闭阶段 ===
    logger.info("Application shutting down...")
    # 可添加资源清理逻辑（数据库连接池关闭等）
    logger.info("Application shutdown complete")

# 应用实例化
app = FastAPI(
    title=settings.APP_NAME,
    description=app_description,
    version=settings.APP_VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,  # 注册生命周期
)
```

#### 日志系统架构（对应 P1-4）

**设计原则**：
- JSON 格式输出（便于日志分析工具解析）
- 包含上下文信息（request_id, user_id, module）
- 分级记录（DEBUG/INFO/WARNING/ERROR）

**实施代码**：
```python
# app/core/logging_config.py
import logging
import json
from datetime import datetime, timezone
from typing import Any, Dict

class JSONFormatter(logging.Formatter):
    """JSON 格式化器"""
    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # 添加额外上下文（如 request_id）
        if hasattr(record, 'request_id'):
            log_data['request_id'] = record.request_id
        if hasattr(record, 'user_id'):
            log_data['user_id'] = record.user_id

        # 添加异常信息
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)

        return json.dumps(log_data, ensure_ascii=False)

def setup_logging() -> None:
    """配置应用日志"""
    # 创建处理器
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(JSONFormatter())

    # 配置根日志
    logging.basicConfig(
        level=logging.INFO if not settings.DEBUG else logging.DEBUG,
        handlers=[console_handler]
    )

    # 设置第三方库日志级别（避免过多日志）
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

# 使用示例：在 service 层
class NoteService:
    def __init__(self, db: Session):
        self.db = db
        self.logger = logging.getLogger(__name__)

    def create_note(self, note_data, user_id):
        self.logger.info(
            "Creating note",
            extra={"user_id": user_id, "note_type": note_data.get("category")}
        )
        # ... 创建逻辑
```

#### 依赖注入架构（对应 P2-1）

**设计原则**：
- 提取重复逻辑为可复用依赖
- 使用 FastAPI Depends 机制
- 支持依赖链组合

**实施代码**：
```python
# app/core/dependencies.py 扩展
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.doubao_service import doubao_service

# 依赖1：检查 Doubao 服务可用性
async def check_doubao_available() -> None:
    """验证 Doubao 服务可用（依赖注入）"""
    available, reason = doubao_service.availability_status()
    if not available:
        detail = f"Doubao 服务未配置：{reason}" if reason else "Doubao 服务未配置"
        raise HTTPException(status_code=503, detail=detail)

# 依赖2：获取当前用户（已有）
from app.models.user import User
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    # ... 解析 token 逻辑
    pass

# 依赖链组合：需要 Doubao + 用户认证
async def require_doubao_and_user(
    _: None = Depends(check_doubao_available),
    user: User = Depends(get_current_user)
) -> User:
    """组合依赖：同时需要 Doubao 可用和用户认证"""
    return user

# 端点使用：声明式依赖
@router.post("/notes/from-image")
async def create_note_from_image(
    file: UploadFile,
    current_user: User = Depends(require_doubao_and_user),  # 组合依赖
    db: Session = Depends(get_db),
):
    # 此时 doubao 已验证可用，user 已认证
    pass
```

### 2.2 安全架构改进

#### 配置管理安全（对应 P0-1, P2-2）

**设计原则**：
- 敏感配置强制从环境变量读取
- 启动时验证必要配置
- 环境感知配置（开发/生产）

**实施代码**：
```python
# app/core/config.py 改造
from typing import List
from pydantic import Field, field_validator

class Settings(BaseSettings):
    # === 安全配置 ===
    SECRET_KEY: str = Field(
        ...,  # 必填，无默认值
        validation_alias="SECRET_KEY",
        description="JWT signing key (MUST be set in production)"
    )

    # === CORS 配置 ===
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"],
        validation_alias="CORS_ORIGINS",
        description="Allowed CORS origins (comma-separated in .env)"
    )

    @field_validator('SECRET_KEY')
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        """验证 SECRET_KEY 不是默认值"""
        if v == "your-secret-key-change-in-production":
            raise ValueError(
                "SECRET_KEY must be changed from default value. "
                "Set it in .env file or environment variable."
            )
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return v

    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        """解析 CORS_ORIGINS（支持逗号分隔字符串）"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v

# .env.example 文件（提供给新手）
"""
# 安全配置（必填）
SECRET_KEY=your-very-secure-random-key-at-least-32-chars-long

# CORS 配置（生产环境修改为实际域名）
CORS_ORIGINS=https://your-frontend-domain.com,https://admin.your-domain.com

# Doubao 配置
DOUBAO_API_KEY=your-doubao-api-key
"""
```

#### 时间处理标准化（对应 P0-3）

**设计原则**：
- 全局使用 timezone-aware datetime
- 统一使用 UTC 时区
- 数据库存储 UTC，展示层转换时区

**实施代码**：
```python
# app/core/security.py 改造
from datetime import datetime, timedelta, timezone

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """创建 JWT 令牌（时区安全）"""
    to_encode = data.copy()

    # 改前：datetime.utcnow()（naive datetime）
    # 改后：datetime.now(timezone.utc)（timezone-aware）
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

# app/main.py 健康检查改造
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),  # ISO 8601 格式
        # 输出示例："2024-05-01T11:20:30.123456+00:00"
    }

# 新手解释：为什么需要 timezone-aware？
"""
场景：用户在东京（UTC+9）和纽约（UTC-5）同时使用应用
- 使用 utcnow()：两地用户的 token 过期时间计算可能不一致
- 使用 now(timezone.utc)：明确标记 UTC 时区，所有地区计算一致
"""
```

### 2.3 数据层架构改进

#### 数据库迁移管理（对应 P2-3）

**设计原则**：
- 使用 Alembic 管理 schema 版本
- 每次 model 变更生成迁移文件
- 支持升级/回滚操作

**实施步骤**：
```bash
# 1. 安装 Alembic
pip install alembic

# 2. 初始化迁移环境
alembic init alembic

# 3. 配置 alembic/env.py
# 修改 target_metadata 指向 SQLAlchemy Base
from app.database import Base
target_metadata = Base.metadata

# 4. 生成初始迁移
alembic revision --autogenerate -m "Initial schema"

# 5. 执行迁移
alembic upgrade head

# 6. 未来添加字段（示例：给 notes 表添加 tags 列）
# - 修改 app/models/note.py
# - 生成迁移文件
alembic revision --autogenerate -m "Add tags to notes"
# - 执行迁移
alembic upgrade head

# 7. 回滚（如果需要）
alembic downgrade -1  # 回滚一个版本
```

**移除旧代码**：
```python
# app/database.py - 删除 ensure_sqlite_schema()
# 改前：手动 ALTER TABLE
def ensure_sqlite_schema() -> None:
    with engine.connect() as connection:
        result = connection.execute(text("PRAGMA table_info(notes)"))
        # ... 手动检查和修改

# 改后：使用 Alembic 管理 schema
# app/main.py 启动逻辑
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 移除 ensure_sqlite_schema() 调用
    # Schema 由 Alembic 管理
    Base.metadata.create_all(bind=engine)  # 仅保留此行
    yield
```

#### 查询安全最佳实践（对应 P1-5）

**设计原则**：
- 强制使用 ORM 查询
- 禁止字符串拼接 SQL
- Code Review 检查点

**安全模式对比**：
```python
# ✅ 正确：使用 ORM filter（当前代码已采用）
def search_notes(self, user_id: str, query: str) -> List[Note]:
    like_expr = f"%{query}%"  # 用户输入
    return (
        self.db.query(Note)
        .filter(
            Note.title.ilike(like_expr)  # ORM 自动转义，安全
        )
        .all()
    )

# ❌ 错误：字符串拼接（绝对禁止）
def search_notes_unsafe(self, query: str):
    sql = f"SELECT * FROM notes WHERE title LIKE '%{query}%'"  # SQL 注入风险
    return self.db.execute(text(sql)).fetchall()

# ✅ 正确：如必须使用原生 SQL，使用参数化查询
def search_notes_raw_safe(self, query: str):
    sql = text("SELECT * FROM notes WHERE title LIKE :pattern")
    return self.db.execute(sql, {"pattern": f"%{query}%"}).fetchall()
```

**自动化安全检查**：
```bash
# 安装 bandit（Python 安全扫描工具）
pip install bandit

# 扫描项目
bandit -r app/ -ll  # 扫描 low 和 medium 风险

# 集成到 pre-commit hook
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.5
    hooks:
      - id: bandit
        args: ['-r', 'app/', '-ll']
```

---

## 三、实施路线图

### 3.1 阶段划分

#### 阶段 1：安全与稳定性修复（1-2 周）

**目标**：修复所有 P0 和 P1 问题，确保系统安全稳定

**任务列表**：
```
□ P0-1: SECRET_KEY 强制验证 + 启动检查
□ P0-2: 异步任务迁移到 BackgroundTasks
□ P0-3: 时间处理迁移到 timezone.utc
□ P1-1: 建立全局异常处理架构
□ P1-2: 迁移到 lifespan 生命周期管理
□ P1-3: Pydantic v2 API 迁移（.dict() → .model_dump()）
□ P1-4: ���立结构化日志系统
□ P1-5: 数据库查询安全审查
```

**验收标准**：
- ✅ 所有安全扫描工具（bandit）无高危问题
- ✅ 应用启动时自动检查配置安全性
- ✅ 所有异步任务异常可捕获
- ✅ JWT 令牌在所有时区正确过期
- ✅ 所有 API 错误返回统一格式
- ✅ 所有关键操作有日志记录

#### 阶段 2：代码质量提升（1 周）

**目标**：消除代码重复，提升可维护性

**任务列表**：
```
□ P2-1: 提取 doubao 检查为 Depends 依赖
□ P2-2: CORS 配置改为���境变量
□ P2-3: 引入 Alembic 数据库迁移
□ P2-4: 增强健康检查端点
□ P2-5: 文档化 API 版本策略
```

**验收标准**：
- ✅ 代码重复率 <5%（使用 pylint 检测）
- ✅ 所有环境相关配置可通过 .env 修改
- ✅ 数据库 schema 变更有迁移记录
- ✅ 健康检查覆盖所有依赖服务

#### 阶段 3：架构优化（可选，1 周）

**目标**：提升系统可观测性和抗压能力

**任务列表**：
```
□ P3-1: 添加 Request ID 追踪
□ P3-2: 引入 API 速率限制
□ P3-3: 建立 API 文档版本控制
```

**验收标准**：
- ✅ 每个请求有唯一 request_id
- ✅ 高频接口有速率限制
- ✅ API 文档变更有版本记录

### 3.2 测试策略

#### 黄金文件测试（Golden Test）

**目的**：确保重构不破坏现有功能

**实施方法**：
```python
# tests/golden/test_api_compatibility.py
import pytest
import json
from pathlib import Path

GOLDEN_DIR = Path(__file__).parent / "golden_responses"

@pytest.mark.parametrize("endpoint,method,payload", [
    ("/api/v1/notes", "GET", None),
    ("/api/v1/health", "GET", None),
    # ... 更多端点
])
def test_api_response_compatibility(client, endpoint, method, payload):
    """验证 API 响应与基准一致"""
    # 1. 调用 API
    if method == "GET":
        response = client.get(endpoint)
    elif method == "POST":
        response = client.post(endpoint, json=payload)

    # 2. 加载基准响应
    golden_file = GOLDEN_DIR / f"{endpoint.replace('/', '_')}_{method}.json"
    if not golden_file.exists():
        # 首次运行：保存基准
        golden_file.write_text(json.dumps(response.json(), indent=2))
        pytest.skip("Saved golden file")

    expected = json.loads(golden_file.read_text())

    # 3. 对比响应（忽略时间戳等动态字段）
    actual = response.json()
    assert actual.keys() == expected.keys(), "Response structure changed"
    # ... 详细对比逻辑
```

**执行流程**：
```bash
# 1. 重构前：生成基准响应
pytest tests/golden/ --save-golden

# 2. 重构中：每次修改后验证
pytest tests/golden/

# 3. 如果测试失败：检查是否为预期变更
# - 预期变更：更新基准文件
# - 非预期变更：修复代码
```

#### 安全测试

**自动化扫描**：
```bash
# 1. 静态代码安全扫描
bandit -r app/ -f json -o security-report.json

# 2. 依赖库漏洞扫描
pip install safety
safety check --json

# 3. 集成到 CI/CD
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Bandit
        run: |
          pip install bandit
          bandit -r app/ -ll -f json -o bandit-report.json
      - name: Upload report
        uses: actions/upload-artifact@v2
        with:
          name: security-reports
          path: bandit-report.json
```

#### 集成测试

**关键场景覆盖**：
```python
# tests/integration/test_note_workflow.py
@pytest.mark.asyncio
async def test_complete_note_workflow(client, test_user):
    """测试完整笔记生成流程"""
    # 1. 上传图片
    with open("tests/fixtures/sample.png", "rb") as f:
        response = client.post(
            "/api/v1/notes/from-image",
            files={"file": f},
            data={"note_type": "学习笔记"}
        )
    assert response.status_code == 202
    job_id = response.json()["job_id"]

    # 2. 轮询任务状态
    for _ in range(10):
        status_response = client.get(f"/api/v1/upload/jobs/{job_id}")
        if status_response.json()["status"] == "COMPLETED":
            break
        await asyncio.sleep(1)

    assert status_response.json()["status"] == "COMPLETED"

    # 3. 验证笔记创建成功
    note_id = status_response.json()["note_id"]
    note_response = client.get(f"/api/v1/notes/{note_id}")
    assert note_response.status_code == 200
    assert note_response.json()["category"] == "学习笔记"
```

---

## 四、风险评估与缓解

### 4.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| **全局异常处理器引入破坏现有逻辑** | 中 | 高 | 1. 分阶段迁移（先添加处理器，再逐步替换 try-except）<br>2. 保留现有 HTTPException 逻辑作为兜底<br>3. 黄金文件测试验证响应格式 |
| **Pydantic v2 迁移引入兼容性问题** | 低 | 中 | 1. IDE 全局搜索替换 `.dict()` → `.model_dump()`<br>2. 单元测试覆盖所有 schema<br>3. 渐进式迁移（先测试层，再业务层） |
| **时区迁移导致现有 token 失效** | 高 | 低 | 1. 部署时通知用户重新登录<br>2. 前端添加 token 过期友好提��<br>3. 考虑延长 token 有效期（7 天→14 天）过渡 |
| **Alembic 迁移失败导致数据丢失** | 低 | 高 | 1. 备份数据库后再执行迁移<br>2. 在测试环境完整验证迁移流程<br>3. 准备回滚脚本 |

### 4.2 操作风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| **SECRET_KEY 验证导致现有部署失败** | 高 | 高 | 1. 提供详细部署��档和 .env.example<br>2. 启动时友好错误提示（指导如何设置）<br>3. 提供密钥生成工具：`python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| **CORS 限制导致前端无法访问** | 中 | 高 | 1. 部署前确认前端域名<br>2. 提供调试端点显示当前 CORS 配置<br>3. 文档化 CORS 配置方法 |
| **日志量激增导致磁盘占满** | 中 | 中 | 1. 配置日志轮转（logrotate）<br>2. 仅 INFO 级别以上输出到文件<br>3. 监控磁盘使用率 |

### 4.3 团队协作风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| **新手不理解架构变更** | 高 | 中 | 1. 每个改动附带代码对比和注释（如本文档示例）<br>2. 提供学习资源链接（FastAPI 官方文档等）<br>3. Code Review 时详细解释设计意图 |
| **配置文件不同步** | 中 | 中 | 1. 提供 .env.example 模板<br>2. README 添加配置说明<br>3. 启动时检查必要配置并提示 |

---

## 五、知识传递（新手学习指南）

### 5.1 核心概念解释

#### 什么是依赖注入（Depends）？

**问题场景**：多个 API 端点都需要检查 Doubao 服务是否可用

**传统做法（代码重复）**：
```python
@router.post("/endpoint1")
async def endpoint1():
    available, reason = doubao_service.availability_status()
    if not available:
        raise HTTPException(...)  # 重复代码
    # ... 业务逻辑

@router.post("/endpoint2")
async def endpoint2():
    available, reason = doubao_service.availability_status()
    if not available:
        raise HTTPException(...)  # 又重复一次
    # ... 业务逻辑
```

**依赖注入做法（代码复用）**：
```python
# 1. 定义依赖
async def check_doubao():
    available, reason = doubao_service.availability_status()
    if not available:
        raise HTTPException(...)

# 2. 声明依赖
@router.post("/endpoint1", dependencies=[Depends(check_doubao)])
async def endpoint1():
    # doubao 已自动检查，无需重复代码
    pass

@router.post("/endpoint2", dependencies=[Depends(check_doubao)])
async def endpoint2():
    # 同样自动检查
    pass
```

**好处**：
- 代码复用：检查逻辑只写一次
- 易于测试：可以 mock 依赖函数
- 清晰声明：看到 `dependencies=[Depends(check_doubao)]` 就知道这个端点需要 Doubao

#### 什么是全局异常处理器？

**问题场景**：每个端点都用 try-except 捕获异常，代码重复

**传统做法**：
```python
@router.post("/notes")
async def create_note():
    try:
        note = note_service.create_note(...)
        return note
    except ServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal error")
```

**全局处理器做法**：
```python
# 1. 在 main.py 注册全局处理器
@app.exception_handler(ServiceError)
async def handle_service_error(request, exc: ServiceError):
    return JSONResponse(status_code=500, content={"error": exc.code})

# 2. 端点只需抛出异常，无需 try-except
@router.post("/notes")
async def create_note():
    note = note_service.create_note(...)  # 异常会被全局处理器捕获
    return note
```

**好处**：
- 统一错误格式：所有 API 返回相同的错误结构
- 减少重复代码：无需每个端点写 try-except
- 易于调试：在一个地方处理所有异常，方便添加日志

#### 为什么需要 timezone-aware datetime？

**场景**：纽约用户（UTC-5）和东京用户（UTC+9）同时使用应用

**错误做���（naive datetime）**：
```python
# 服务器在北京（UTC+8）
expire = datetime.utcnow() + timedelta(hours=1)
# 问题：utcnow() 返回的是 "2024-05-01 10:00:00"（没有时区标记）
# 纽约用户的浏览器可能解释为纽约时间，导致计算错误
```

**正确做法（timezone-aware）**：
```python
expire = datetime.now(timezone.utc) + timedelta(hours=1)
# 返回 "2024-05-01 10:00:00+00:00"（明确标记为 UTC）
# 所有用户的浏览器都能正确转换为本地时间
```

**ISO 8601 格式**：
```python
timestamp = datetime.now(timezone.utc).isoformat()
# 输出："2024-05-01T10:00:00.123456+00:00"
# 前端可直接解析：new Date("2024-05-01T10:00:00.123456+00:00")
```

### 5.2 调试技巧

#### 如何调试全局异常处理器？

**添加调试日志**：
```python
@app.exception_handler(ServiceError)
async def handle_service_error(request: Request, exc: ServiceError):
    logger.error(
        f"Service error occurred",
        extra={
            "error_code": exc.code,
            "error_message": exc.message,
            "path": request.url.path,
            "method": request.method,
        },
        exc_info=True  # 打印完整堆栈
    )
    return JSONResponse(...)
```

**测试异常处理器**：
```python
# tests/test_exception_handlers.py
def test_service_error_handler(client):
    # 故意触发 ServiceError
    response = client.post("/api/v1/trigger-error")

    # 验证响应格式
    assert response.status_code == 500
    assert response.json()["error"] == "SERVICE_ERROR"
```

#### 如何验证 JWT 时区正确性？

**解析 token 查看 exp 字段**：
```python
import jwt
from datetime import datetime, timezone

token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])

exp_timestamp = payload["exp"]
exp_datetime = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
print(f"Token expires at: {exp_datetime.isoformat()}")
# 输出：Token expires at: 2024-05-08T10:00:00+00:00
```

**测试不同时区**：
```python
# tests/test_jwt_timezone.py
def test_jwt_expiration_timezone():
    # 创建 token
    token = create_access_token({"sub": "user123"}, timedelta(hours=1))

    # 解析 token
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    exp_time = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)

    # 验证过期时间在 1 小时后
    now = datetime.now(timezone.utc)
    assert timedelta(minutes=59) < (exp_time - now) < timedelta(minutes=61)
```

### 5.3 最佳实践总结

#### ✅ 推荐做法

```python
# 1. 使用依赖注入消除重复代码
@router.post("/endpoint", dependencies=[Depends(check_service)])

# 2. 抛出领域异常，交给全局处理器
raise ServiceError("User not found", code="USER_NOT_FOUND")

# 3. 使用 timezone-aware datetime
datetime.now(timezone.utc)

# 4. 使用 Pydantic v2 API
model.model_dump(exclude_unset=True)

# 5. 使用 ORM 参数化查询
query.filter(Note.title.ilike(f"%{keyword}%"))

# 6. 结构化日志记录
logger.info("Note created", extra={"note_id": note.id, "user_id": user.id})
```

#### ❌ 避免做法

```python
# 1. 硬编码敏感配置
SECRET_KEY = "hardcoded-secret"  # ❌

# 2. 使用 asyncio.create_task 无异常处理
asyncio.create_task(background_job())  # ❌

# 3. 使用 naive datetime
datetime.utcnow()  # ❌ 已弃用

# 4. 使用 Pydantic v1 API
model.dict()  # ❌ v2 已弃用

# 5. 字符串拼接 SQL
f"SELECT * FROM notes WHERE id = {user_input}"  # ❌ SQL 注入

# 6. 不记录日志
# ❌ 关键操作无日志，出问题无法追踪
```

---

## 六、总结与建议

### 6.1 架构改进核心价值

**安全性提升**：
- 消除硬编码密钥风险（P0-1）
- 建立时区安全机制（P0-3）
- 统一 CORS 配置（P2-2）

**稳定性提升**：
- 异常不再静默丢失（P0-2）
- 全局异常处理保证错误可追踪（P1-1）
- 结构化日志支持问题排查（P1-4）

**可维护性提升**：
- 代码重复率降低（P2-1）
- 依赖注入提升可测试性
- Alembic 管理 schema 变更（P2-3）

**学习价值**：
- 每个改动都有"改前/改后"对比
- 注释解释设计意图
- 新手友好的调试技巧

### 6.2 推荐实施顺序

**第一优先级**（立即执行）：
1. P0-1: SECRET_KEY 验证（安全风险最高）
2. P0-2: BackgroundTasks 迁移（影响用户体验）
3. P1-1: 全局异常处理（架构基础）

**第二优先级**（本周内）：
4. P0-3: 时间处理标准化
5. P1-2: lifespan 迁移
6. P1-4: 日志系统建立

**第三优先级**（下周）：
7. P1-3: Pydantic v2 迁移
8. P2-1: 依赖注入重构
9. P2-3: Alembic 引入

### 6.3 长期架构演进建议

**技术栈升级路径**：
```
当前：FastAPI 0.104.1 → 目标：FastAPI 0.110+（支持更多新特性）
当前：SQLite → 未来：PostgreSQL（生产环境推荐）
当前：无缓存 → 未来：Redis（性能优化）
当前：单体应用 → 未来：微服务拆分（规模扩大后）
```

**监控与可观测性**：
```
阶段 1：结构化日志（本次重构）
阶段 2：集成 Prometheus + Grafana（性能指标）
阶段 3：分布式追踪（OpenTelemetry）
```

**安全持续改进**：
```
当前：基础安全（SECRET_KEY, CORS）
短期：引入 OAuth2 认证
中期：API 速率限制 + WAF
长期：零信任架构
```

---

## 附录

### A. 配置文件示例

#### .env.example
```bash
# ==========================================
# AI Note App 后端配置文件示例
# ==========================================
# 使用说明：
# 1. 复制此文件为 .env
# 2. 修改所有标记为【必填】的配置
# 3. 根据环境修改【可选】配置
# ==========================================

# === 应用基础配置 ===
APP_NAME=AI Note API
APP_VERSION=1.0.0
DEBUG=true  # 生产环境改为 false

# === 安全配置【必填】===
# JWT 签名密钥（至少 32 字符，生产环境必须修改）
# 生成命令：python -c "import secrets; print(secrets.token_urlsafe(32))"
SECRET_KEY=your-very-secure-random-key-at-least-32-chars-long

# === CORS 配置【必填】===
# 允许的前端域名（逗号分隔）
# 开发环境：http://localhost:3000,http://localhost:5173
# 生产环境：https://your-frontend-domain.com
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# === 数据库配置【可选】===
# SQLite（默认）
DATABASE_URL=sqlite:///./app.db
# PostgreSQL（生产环境推荐）
# DATABASE_URL=postgresql://user:password@localhost/dbname

# === Doubao AI 配置【必填】===
# 方式1：使用 API Key
DOUBAO_API_KEY=your-doubao-api-key

# 方式2：使用 Access Key + Secret Key（优先级低于 API Key）
# DOUBAO_ACCESS_KEY_ID=your-access-key-id
# DOUBAO_SECRET_ACCESS_KEY=your-secret-access-key

# Doubao 模型配置【可选】
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MODEL_ID=doubao-seed-1-6-vision-250815
DOUBAO_MAX_COMPLETION_TOKENS=6000

# === 管理员门户配置【可选】===
# 留空则禁用管理员门户
ADMIN_PORTAL_API_KEY=your-admin-portal-key
```

### B. 部署检查清单

```markdown
## 部署前检查清单

### 配置验证
- [ ] 已设置 SECRET_KEY（不是默认值）
- [ ] 已设置 CORS_ORIGINS（匹配前端域名）
- [ ] 已设置 DOUBAO_API_KEY 或 AK/SK
- [ ] DEBUG=false（生产环境）

### 数据库准备
- [ ] 已备份现有数据库
- [ ] 已执行 Alembic 迁移（alembic upgrade head）
- [ ] 已验证数据库连接

### 安全检查
- [ ] 已运行安全扫描（bandit -r app/ -ll）
- [ ] 无硬编码敏感信息
- [ ] CORS 配置正确

### 测试验证
- [ ] 单元测试通过（pytest tests/）
- [ ] 集成测试通过（pytest tests/integration/）
- [ ] 黄金文件测试通过（pytest tests/golden/）

### 监控准备
- [ ] 日志系统正常输出
- [ ] 健康���查端点可访问（/health）
- [ ] 监控告警配置完成

### 文档更新
- [ ] README 更新部署说明
- [ ] API 文档版本记录
- [ ] CHANGELOG 更新变更日志
```

### C. 学习资源

**FastAPI 官方文档**：
- Dependency Injection: https://fastapi.tiangolo.com/tutorial/dependencies/
- Background Tasks: https://fastapi.tiangolo.com/tutorial/background-tasks/
- Lifespan Events: https://fastapi.tiangolo.com/advanced/events/

**Pydantic v2 迁移指南**：
- https://docs.pydantic.dev/latest/migration/

**Python 时区处理**：
- https://docs.python.org/3/library/datetime.html#aware-and-naive-objects

**SQLAlchemy 安全最佳实践**：
- https://docs.sqlalchemy.org/en/20/core/connections.html#using-textual-sql

**Alembic 数据库迁移**：
- https://alembic.sqlalchemy.org/en/latest/tutorial.html

---

**生成时间**: 2025-11-18
**文档版本**: 1.0
**框架参考**: @../guidance-specification.md
**会话**: WFS-backend-refactor
