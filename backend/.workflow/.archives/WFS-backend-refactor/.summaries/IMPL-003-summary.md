# Task: IMPL-003 架构模式和代码质量改进 (P1)

## Implementation Summary

### Files Modified
- `app/core/exceptions.py`: **新增文件** - 自定义异常类 (ServiceError, DoubaoServiceUnavailable, NoteNotFoundError, DatabaseError)
- `app/core/dependencies.py`: 新增 check_doubao_available() 依赖注入函数, 导入自定义异常
- `app/core/logging_config.py`: **新增文件** - 统一日志系统配置 (setup_logging 函数)
- `app/main.py`: 新增全局异常处理器 @app.exception_handler(ServiceError), 导入 logging_config 并在 lifespan 中调用 setup_logging()
- `app/api/v1/endpoints/library.py`: 应用依赖注入和 BackgroundTasks (删除重复代码, 修改 2 个端点)
- `app/services/note_service.py`: 新增日志记录 (create_note, delete_note), 导入 logging 和 NoteNotFoundError

### Content Added

#### 自定义异常类 (app/core/exceptions.py)
```python
# 业务异常基类
class ServiceError(Exception):
    def __init__(self, detail: str, status_code: int = 500)

# 具体异常类
class DoubaoServiceUnavailable(ServiceError):  # status_code=503
class NoteNotFoundError(ServiceError):  # status_code=404
class DatabaseError(ServiceError):  # status_code=500
```

#### 依赖注入函数 (app/core/dependencies.py:46-68)
```python
async def check_doubao_available() -> None:
    """检查 Doubao 服务可用性 (依赖注入)"""
    available, reason = doubao_service.availability_status()
    if not available:
        raise DoubaoServiceUnavailable(reason)
```

#### 全局异常处理器 (app/main.py:131-161)
```python
@app.exception_handler(ServiceError)
async def service_error_handler(request: Request, exc: ServiceError):
    """业务异常统一处理, 返回标准化 JSON 错误响应"""
    # 记录异常日志并返回标准格式
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.__class__.__name__,
            "detail": exc.detail,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
```

#### 日志配置函数 (app/core/logging_config.py:20-44)
```python
def setup_logging() -> None:
    """配置应用日志系统 (根日志器, StreamHandler, 第三方库日志级别)"""
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    # 配置 basicConfig + StreamHandler
    # 设置第三方库日志级别 (uvicorn, sqlalchemy)
```

#### 端点改进 (app/api/v1/endpoints/library.py)
**改前问题**:
- 第 76-81 行: 重复的 doubao_service.availability_status() 检查代码
- 第 97-105 行: 使用 asyncio.create_task() 启动后台任务 (异常被吞没)
- 第 133-138 行: 重复的 doubao_service.availability_status() 检查代码

**改后**:
```python
# create_note_from_image 端点
@router.post("/notes/from-image", dependencies=[Depends(check_doubao_available)])  # 依赖注入
async def create_note_from_image(
    background_tasks: BackgroundTasks,  # 新增参数
    ...
):
    # 删除 76-81 行重复代码
    # 第 109-116 行: background_tasks.add_task() 替代 asyncio.create_task()

# extract_text_from_image 端点
@router.post("/text/from-image", dependencies=[Depends(check_doubao_available)])  # 依赖注入
async def extract_text_from_image(...):
    # 删除 133-138 行重复代码
```

#### 服务层日志记录 (app/services/note_service.py)
```python
# 第 28 行: logger.info 记录笔记创建
# 第 33 行: logger.debug 记录笔记 ID
# 第 91 行: logger.warning 记录笔记删除 (审计日志)
```

## Outputs for Dependent Tasks

### Available Components

```python
# 自定义异常类 (可在所有 service 层使用)
from app.core.exceptions import ServiceError, DoubaoServiceUnavailable, NoteNotFoundError, DatabaseError

# 依赖注入函数 (可在所有端点使用)
from app.core.dependencies import check_doubao_available

# 日志配置 (已在 main.py lifespan 中调用, 所有模块可直接使用 logging.getLogger(__name__))
import logging
logger = logging.getLogger(__name__)
```

### Integration Points

- **全局异常处理**: Service 层直接抛出自定义异常 (如 `raise DoubaoServiceUnavailable(reason)`), 全局处理器会自动捕获并返回标准 JSON 格式
- **依赖注入**: 端点装饰器添加 `dependencies=[Depends(check_doubao_available)]` 自动检查服务可用性
- **BackgroundTasks**: 端点函数签名添加 `background_tasks: BackgroundTasks` 参数, 使用 `background_tasks.add_task()` 启动后台任务
- **日志记录**: Service 层添加 `logger = logging.getLogger(__name__)`, 使用 `logger.info/debug/warning/error` 记录业务操作

### Usage Examples

```python
# 示例 1: Service 层抛出自定义异常
class NoteService:
    def get_note_by_id(self, note_id: str, user_id: str) -> Note:
        note = self.db.query(Note).filter(...).first()
        if not note:
            raise NoteNotFoundError(note_id)  # 全局处理器会捕获
        return note

# 示例 2: 端点使用依赖注入
@router.post("/api/endpoint", dependencies=[Depends(check_doubao_available)])
async def endpoint(...):
    # Doubao 可用性已自动检查, 无需重复代码
    pass

# 示例 3: 使用 BackgroundTasks
@router.post("/api/task")
async def create_task(background_tasks: BackgroundTasks, ...):
    background_tasks.add_task(process_job, job_id, ...)  # 自动异常处理
    return {"status": "queued"}

# 示例 4: Service 层日志记录
class Service:
    def __init__(self, db: Session):
        self.logger = logging.getLogger(__name__)

    def operation(self):
        self.logger.info("Operation started")
        # ... 业务逻辑
        self.logger.debug("Operation details")
```

## Verification Results

### 架构改进验证
✅ **新增 3 个核心文件存在**:
- `app/core/exceptions.py` (60 行代码, 4 个异常类)
- `app/core/logging_config.py` (45 行代码, setup_logging 函数)
- `app/core/dependencies.py` (68 行代码, check_doubao_available 函数)

✅ **全局异常处理器生效**: main.py 第 131-161 行注册 @app.exception_handler(ServiceError)

✅ **BackgroundTasks 替换 asyncio.create_task**: library.py 第 109-116 行使用 background_tasks.add_task()

✅ **依赖注入消除代码重复**:
- library.py 删除第 76-81 行和 133-138 行重复代码 (共 12 行)
- check_doubao_available() 在 dependencies.py 定义 1 次, 2 个端点通过 dependencies=[Depends(...)] 复用

✅ **统一日志记录**:
- main.py lifespan 第 85 行调用 setup_logging()
- note_service.py 第 11 行导入 logger, 第 28/33/91 行添加日志记录点

## Status: ✅ Complete

**完成时间**: 2025-11-18
**代码改动**: 6 个文件 (3 个新增, 3 个修改)
**代码行数**: 新增 ~180 行, 删除 ~14 行, 修改 ~30 行
**学习要点**: 全局异常处理, 依赖注入, BackgroundTasks, 日志记录, 代码复用
