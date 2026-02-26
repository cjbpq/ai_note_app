# Backend 系统化重构 - 确认指导规范

**元数据**:
- 会话ID: WFS-backend-refactor
- 类型: 后端重构（学习导向）
- 焦点: 代码可维护性 + 全面质量提升
- 参与角色: system-architect, subject-matter-expert, test-strategist
- 生成时间: 2025-11-18

---

## 1. 项目定位与目标

**CONFIRMED 目标**: 对 FastAPI backend 进行系统化优化重构，提升代码可维护性和质量，为后端新手提供学习资源

**CONFIRMED 成功标准**:
- 修复全部 16 个已识别问题（3 严重 + 5 高优先级 + 5 中等 + 3 低优先级）
- 建立统一的错误处理、日志记录、异步任务管理模式
- 通过黄金文件测试验证重构不破坏现有功能
- 每处改动附带代码对比和简短注释，帮助新手理解最佳实践

**CONFIRMED 约束**:
- 直接替换旧 API，不保留兼容层（包括废弃端点移除）
- 使用现有技术栈（FastAPI + SQLAlchemy + pytest），不引入重型依赖
- 增量提交，确保每个阶段独立可测试

---

## 2. System Architect（系统架构师）决策

### SELECTED 技术选择

**错误处理架构**: 自定义异常层次 + 全局异常处理器
- **原理**: 定义业务异常类（ServiceError, DatabaseError, ExternalServiceError），FastAPI 全局 `@app.exception_handler` 统一捕获
- **影响**: 替换所有泛型 `except Exception`，返回标准化错误响应格式
- **实施位置**:
  - 新增 `app/core/exceptions.py`（异常类定义）
  - 修改 `app/main.py`（全局异常处理器注册）
  - 修改 `app/services/doubao_service.py`、`app/core/dependencies.py` 等（使用自定义异常）

**异步任务管理**: FastAPI BackgroundTasks
- **原理**: 使用 FastAPI 内置 `BackgroundTasks`，自动异常捕获和日志记录
- **影响**: 替换 `app/api/v1/endpoints/library.py:97` 的 `asyncio.create_task`
- **优势**: 轻量级、零额外依赖、自动异常处理
- **实施**:
  ```python
  # 改前: asyncio.create_task(process_task())
  # 改后: background_tasks.add_task(process_task)
  ```

**日志系统设计**: Python logging + 结构化日志（JSON 格式）
- **原理**: 使用标准库 `logging`，配置 JSON formatter，输出到文件和控制台
- **影响**: 在所有 service 层、核心模块添加日志记录点
- **实施位置**:
  - 新增 `app/core/logging_config.py`（日志配置）
  - 修改 `app/main.py`（应用启动时初始化日志）
  - 修改所有 service 文件（添加 logger 实例和关键日志点）
- **日志级别策略**:
  - DEBUG: 详细调试信息（开发环境）
  - INFO: 关键业务操作（用户登录、笔记创建）
  - WARNING: 可恢复的异常（外部服务降级）
  - ERROR: 需要人工介入的错误

**应用生命周期管理**: 迁移到 lifespan context manager
- **原理**: 使用 FastAPI 0.93+ 的 `@asynccontextmanager` + `app = FastAPI(lifespan=...)`
- **影响**: 替换 `app/main.py` 中已弃用的 `@app.on_event('startup')` 和 `@app.on_event('shutdown')`
- **实施**:
  ```python
  # 改前:
  # @app.on_event("startup")
  # async def startup():
  #     ensure_sqlite_schema()

  # 改后:
  # @asynccontextmanager
  # async def lifespan(app: FastAPI):
  #     ensure_sqlite_schema()
  #     yield
  #     # cleanup logic
  ```

### 跨角色考量
- 与 subject-matter-expert 的依赖注入模式配合：doubao 可用性检查提取为 Depends
- 与 test-strategist 的测试策略配合：异常处理器可通过集成测试验证

---

## 3. Subject Matter Expert（领域专家 - Python/FastAPI）决策

### SELECTED 技术迁移

**Pydantic v2 迁移**: 全局替换 dict() → model_dump()
- **原理**: Pydantic v2 弃用 `dict()` 方法，推荐使用 `model_dump()` 和 `model_dump_json()`
- **影响**: 修改 `app/api/v1/endpoints/library.py:264` 和所有使用 `.dict()` 的地方
- **实施**:
  ```python
  # 改前: note_dict = note_update.dict(exclude_unset=True)
  # 改后: note_dict = note_update.model_dump(exclude_unset=True)
  ```
- **相关概念**: `exclude_unset=True` 只序列化用户提供的字段，避免覆盖未修改的数据

**时间处理标准化**: datetime.now(timezone.utc) + 强制 timezone-aware
- **原理**: Python 3.11+ 弃用 `datetime.utcnow()`，推荐使用带时区的 `datetime.now(timezone.utc)`
- **影响**: 修改 `app/core/security.py:11,13` 和所有时间相关代码
- **实施**:
  ```python
  # 改前: expire = datetime.utcnow() + timedelta(minutes=15)
  # 改后: expire = datetime.now(timezone.utc) + timedelta(minutes=15)
  ```
- **学习要点**: timezone-aware datetime 避免时区混淆，推荐全局使用 UTC

**代码重复消除**: 提取为依赖注入函数（FastAPI Depends）
- **原理**: 使用 FastAPI Depends 机制，将重复逻辑提取为可复用依赖
- **影响**: 修改 `app/api/v1/endpoints/library.py` 中多处 doubao 可用性检查
- **实施**:
  ```python
  # 新增 app/core/dependencies.py:
  # async def check_doubao_available() -> None:
  #     if not doubao_service.is_available():
  #         raise HTTPException(...)

  # 端点中使用:
  # @router.post("/analyze", dependencies=[Depends(check_doubao_available)])
  ```
- **学习要点**: Depends 是 FastAPI 的核心特性，支持依赖注入、参数验证、权限检查

**数据库查询安全**: 使用 SQLAlchemy 参数化查询（filter + ilike）
- **原理**: ORM 自动转义，避免 SQL 注入，使用 `.filter()` + `.ilike()` 实现模糊查询
- **影响**: 修改 `app/services/note_service.py:99` 的 search_notes 方法
- **实施**:
  ```python
  # 改前: query += f" AND title LIKE '%{keyword}%'"
  # 改后: query = query.filter(Note.title.ilike(f"%{keyword}%"))
  ```
- **学习要点**: 永远不要手动拼接 SQL 字符串，使用 ORM 的参数化查询

### 跨角色考量
- 与 system-architect 的异常处理配合：依赖注入可抛出自定义异常
- 与 test-strategist 的安全扫描配合：bandit 可检测不安全的时间/字符串操作

---

## 4. Test Strategist（测试策略师）决策

### SELECTED 测试策略

**测试覆盖优先级**: 核心业务 > 安全 > 性能 > 错误处理
- **原理**: 优先确保功能不退化，其次验证安全修复，最后验证性能和错误处理改进
- **影响**: 测试编写和执行顺序
- **测试阶段**:
  1. 核心业务：笔记 CRUD、用户认证、AI 分析功能
  2. 安全：SECRET_KEY、CORS、SQL 注入、异常处理
  3. 性能：数据库查询优化、异步任务执行
  4. 错误处理：全局异常处理器、自定义异常层次

**重构验证方式**: 黄金文件测试（Golden Test）
- **原理**: 在重构前保存 API 响应作为基准（golden files），重构后对比确保行为一致
- **影响**: 新增测试文件 `tests/golden/` 目录，保存基准响应
- **实施步骤**:
  1. 重构前：运行所有 API 端点，保存响应到 `tests/golden/*.json`
  2. 重构中：每个阶段完成后运行测试，对比响应差异
  3. 验证通过：响应格式一致，仅实现细节不同
- **工具**: 使用 pytest + `deepdiff` 库对比 JSON 响应

**异步任务测试**: pytest-asyncio + 模拟（Mock）依赖
- **原理**: 使用 `pytest-asyncio` 标记异步测试，mock 外部服务（doubao_service）
- **影响**: 修改 `tests/test_async_pipeline.py`，新增 BackgroundTasks 测试用例
- **实施**:
  ```python
  # @pytest.mark.asyncio
  # async def test_background_task_execution(mocker):
  #     mock_service = mocker.patch("app.services.doubao_service")
  #     # 验证任务被添加到 BackgroundTasks
  #     # 验证任务执行完成
  ```
- **学习要点**: Mock 用于隔离外部依赖，加速测试并避免网络调用

**安全修复验证**: 使用安全扫描工具（bandit、safety）
- **原理**: 自动化扫描已知漏洞模式（SQL 注入、硬编码密钥、不安全的随机数）
- **影响**: 新增 CI/CD 流程中的安全扫描步骤
- **实施**:
  ```bash
  # 安装工具
  pip install bandit safety

  # 扫描命令
  bandit -r app/ -ll  # 扫描 low 和 medium 风险
  safety check --json  # 检查依赖漏洞
  ```
- **检测范围**:
  - SECRET_KEY 硬编码检测
  - SQL 注入模式检测（字符串拼接）
  - 不安全的时间处理（utcnow）
  - 依赖库已知 CVE 漏洞

### 跨角色考量
- 与 system-architect 配合：BackgroundTasks 测试验证异步任务异常处理
- 与 subject-matter-expert 配合：安全扫描可检测未迁移的已弃用 API

---

## 跨角色集成点

**CONFIRMED 集成架构**:

1. **异常处理流程**:
   ```
   Service Layer (raise custom exception)
   → Global Exception Handler (system-architect)
   → Structured JSON Error Response
   → Logged with context (logging_config)
   → Validated by Golden Test (test-strategist)
   ```

2. **依赖注入链**:
   ```
   API Endpoint
   → Depends(check_doubao_available) (subject-matter-expert)
   → Depends(get_current_user) (existing)
   → Service Layer
   → Database/External Service
   ```

3. **测试覆盖矩阵**:
   | 模块 | 单元测试 | 集成测试 | 安全扫描 | 黄金文件测试 |
   |------|---------|---------|---------|-------------|
   | 异常处理 | ✓ | ✓ | - | ✓ |
   | BackgroundTasks | ✓ (mock) | ✓ | - | ✓ |
   | 依赖注入 | ✓ | ✓ | - | ✓ |
   | SQL 查询 | ✓ | ✓ | ✓ (bandit) | ✓ |
   | 安全配置 | - | ✓ | ✓ (bandit) | - |

---

## 风险与约束

**识别风险**:
1. **API 破坏性变更** → 缓解：黄金文件测试 + 前端同步修改
2. **全局异常处理器引入** → 缓解：逐步迁移，保留现有 HTTPException 逻辑
3. **Pydantic v2 全局替换** → 缓解：IDE 批量重构 + 单元测试覆盖
4. **时区迁移** → 缓解：确保所有 datetime 都是 timezone-aware

**CONFIRMED 约束**:
- 技术栈限制：不引入 Celery、Elasticsearch 等重型依赖
- 学习导向：代码对比格式必须包含"改前/改后"注释
- 直接替换：不保留 `@app.on_event`、`dict()` 等已弃用 API
- 测试要求：所有重构必须通过黄金文件测试验证

---

## 下一步行动

**⚠️ 自动化继续**（从 auto-parallel 调用时）:
- auto-parallel 将分配 3 个 conceptual-planning-agent，分别为：
  - system-architect：生成异常处理、日志、lifespan 迁移的详细设计
  - subject-matter-expert：生成 Pydantic v2、timezone、依赖注入、SQL 安全的迁移指南
  - test-strategist：生成测试计划、黄金文件测试框架、安全扫描集成方案
- 每个 agent 将读取此 guidance-specification.md 作为框架上下文
- 最终生成 synthesis-specification.md 整合三个角色的分析

**手动触发选项**（独立使用时）:
```bash
# 启动角色分析
/workflow:brainstorm:system-architect
/workflow:brainstorm:subject-matter-expert
/workflow:brainstorm:test-strategist

# 或使用综合分析
/workflow:brainstorm:synthesis --session WFS-backend-refactor
```

---

## 附录：决策追踪表

| 决策 ID | 类别 | 问题 | 选择 | 阶段 | 原理 |
|---------|------|------|------|------|------|
| D-001 | 意图 | 重构优先级 | 代码可维护性 | 1 | 新手学习最佳实践，提升代码质量 |
| D-002 | 意图 | 学习深度 | 代码对比 + 简短注释 | 1 | 平衡学习效果和代码可读性 |
| D-003 | 意图 | 破坏性变更 | 直接替换 | 1 | 简化代码，避免技术债务 |
| D-004 | 意图 | 重构范围 | 全面质量提升 | 1 | 系统性改进，长期收益高 |
| D-005 | system-architect | 错误处理架构 | 自定义异常 + 全局处理器 | 3 | 标准化错误响应，易于调试 |
| D-006 | system-architect | 异步任务管理 | FastAPI BackgroundTasks | 3 | 轻量级，自动异常处理 |
| D-007 | system-architect | 日志系统设计 | logging + JSON 格式 | 3 | 标准库，便于日志分析 |
| D-008 | system-architect | 生命周期管理 | lifespan context manager | 3 | FastAPI 新标准，统一资源管理 |
| D-009 | subject-matter-expert | Pydantic v2 迁移 | dict() → model_dump() | 3 | Pydantic v2 标准方法 |
| D-010 | subject-matter-expert | 时间处理标准化 | datetime.now(timezone.utc) | 3 | 避免时区混淆，Python 推荐 |
| D-011 | subject-matter-expert | 代码重复消除 | 依赖注入（Depends） | 3 | FastAPI 设计模式，代码复用 |
| D-012 | subject-matter-expert | 数据库查询安全 | SQLAlchemy filter + ilike | 3 | ORM 防注入，类型安全 |
| D-013 | test-strategist | 测试覆盖策略 | 核心业务 > 安全 > 性能 > 错误处理 | 3 | 优先保证功能不退化 |
| D-014 | test-strategist | 重构验证方式 | 黄金文件测试 | 3 | 快速发现回归问题 |
| D-015 | test-strategist | 异步任务测试 | pytest-asyncio + Mock | 3 | 标准异步测试方案 |
| D-016 | test-strategist | 安全修复验证 | bandit + safety 扫描 | 3 | 自动化检测已知漏洞 |

---

**生成时间**: 2025-11-18
**框架版本**: artifacts v2.0 (with Phase 0 context collection)
**文档状态**: CONFIRMED - 所有决策已通过用户确认
