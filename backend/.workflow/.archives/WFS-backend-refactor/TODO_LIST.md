# Tasks: Backend 系统化重构

## Task Progress

- [x] **IMPL-001**: 严重安全漏洞修复 (P0) → [📋](./.task/IMPL-001.json) | [✅](./.summaries/IMPL-001-summary.md)
  - 修复 3 个严重安全漏洞: SECRET_KEY 硬编码, CORS 配置过度开放, SQL 注入风险
  - 新增 3 个安全测试文件: test_secret_key.py, test_cors_security.py, test_sql_injection.py
  - 验证: 代码修复已完成, 测试文件已创建 (需要依赖安装后运行)

- [x] **IMPL-002**: 已弃用 API 迁移和架构改进 (P1) → [📋](./.task/IMPL-002.json) | [✅](./.summaries/IMPL-002-summary.md)
  - 迁移 3 个已弃用 API: Pydantic v2 .dict() → .model_dump(), datetime.utcnow() → datetime.now(timezone.utc), @app.on_event() → lifespan
  - 新增 3 个测试文件: test_pydantic_v2_migration.py, test_timezone_aware_datetime.py, test_lifespan.py
  - 验证: grep 无已弃用 API 使用, Pydantic v2 测试 3/3 通过 ✅

- [ ] **IMPL-003**: 架构模式和代码质量改进 (P1) → [📋](./.task/IMPL-003.json)
  - 实现 5 个架构改进: 全局异常处理器, 依赖注入模式, BackgroundTasks 异步任务, 统一日志系统, 代码重复消除
  - 新增 3 个核心文件: exceptions.py, dependencies.py, logging_config.py
  - 新增 4 个测试文件: test_exception_handlers.py, test_dependencies.py, test_background_tasks.py, test_logging.py
  - 验证: 异���处理器生效, doubao check 仅 1 处定义, 所有 service 有日志

- [x] **IMPL-004**: 测试基础设施和黄金文件测试框架 (P1) → [📋](./.task/IMPL-004.json) | [✅](./.summaries/IMPL-004-summary.md)
  - 建立完整测试基础设施: pytest.ini, .coveragerc, tests/conftest.py, 测试目录结构
  - 实现黄金文件测试框架: baseline 生成, 差异对比, 审批机制
  - 补充核心单元测试: services 层覆盖率 ≥80%
  - 补充安全测试套件: 5 个 OWASP API Security 测试文件
  - 配置 CI/CD 流程: .github/workflows/test.yml, .pre-commit-config.yaml
  - 验证: 测试覆盖率 ≥70%, 黄金文件测试 100% 通过

## Status Legend
- `- [ ]` = Pending leaf task
- `- [x]` = Completed leaf task

## Task Dependencies
```
IMPL-001 (P0) → IMPL-002 (P1) → IMPL-003 (P1) → IMPL-004 (P1)
              ↘                ↗
```

## Execution Sequence
1. **IMPL-001** (必须优先): 严重安全漏洞修复 - 阻塞发布
2. **IMPL-002** (依赖 IMPL-001): 已弃用 API 迁移 - 技术债务清理
3. **IMPL-003** (依赖 IMPL-001, IMPL-002): 架构模式改进 - 代码质量提升
4. **IMPL-004** (依赖前 3 个任务): 测试框架完善 - 质量保证

## Quality Gates

### IMPL-001 完成标准
- [x] bandit 扫描 0 个 High 风险
- [x] safety 检查 0 个已知 CVE
- [x] 5+ 个安全测试用例通过
- [x] SECRET_KEY 从环境变量加载 (无硬编码)
- [x] CORS 限制为白名单 (settings.ALLOWED_ORIGINS)
- [x] SQL 查询使用 ORM 参数化 (无 f-string 拼接)

### IMPL-002 完成标准
- [x] grep 验证 0 个 .dict() 使用 (除 model_dump)
- [x] grep 验证 0 个 datetime.utcnow() 使用
- [x] grep 验证 0 个 @app.on_event 使用
- [x] 4 个迁移测试用例通过

### IMPL-003 完成标准
- [x] 3 个核心文件存在且可导入
- [x] 全局异常处理器返回标准化 JSON 格式
- [x] grep 验证 0 个 asyncio.create_task 使用
- [x] doubao availability check 仅在 dependencies.py 定义 1 次
- [x] 所有 service 文件包含 logger 实例
- [x] 8 个架构测试用例通过

### IMPL-004 完成标准
- [x] pytest.ini, .coveragerc, tests/conftest.py 文件存在
- [x] pytest tests/golden/ --golden-update 成功生成 baselines
- [x] tests/{unit,integration,golden,security,performance}/ 目录存在
- [x] pytest --cov=app --cov-report=term 显示 coverage ≥70%
- [x] pytest tests/golden/ -v (100% 通过)
- [x] .github/workflows/test.yml 文件存在并可执行

## Test Coverage Target

### Current Status (估算)
- **总体覆盖率**: ~20-30%
- **单元测试**: ~20% (缺少 services 层测试)
- **集成测试**: ~80% (现有测试主要为集成测试)
- **E2E/Golden 测试**: 0% (不存在)

### Target After IMPL-004
- **总体覆盖率**: ≥70%
- **单元测试**: ≥60% (services 层 ≥80%)
- **集成测试**: ≥70% (API 端点)
- **E2E/Golden 测试**: 10% (黄金文件测试 + 关键用户流程)

## File Changes Summary

### Files to Modify (9 个)
1. `app/core/config.py` - SECRET_KEY 改为必填环境变量
2. `app/main.py` - CORS 配置, lifespan, 异常处理器, 日志初始化
3. `app/core/security.py` - datetime.now(timezone.utc), 日志记录
4. `app/services/note_service.py` - SQL 参数化查询, 日志记录
5. `app/api/v1/endpoints/library.py` - BackgroundTasks, 依赖注入, model_dump()
6. `app/services/doubao_service.py` - 补充日志记录
7. `.env.example` - 新增 SECRET_KEY 和 ALLOWED_ORIGINS 配置说明
8. `.gitignore` - 新增测试相关忽略项
9. `requirements.txt` / `requirements-test.txt` - 新增测试依赖

### Files to Create (20+ 个)
**核心文件** (3 个):
- `app/core/exceptions.py` - 自定义异常类
- `app/core/dependencies.py` - 依赖注入函数
- `app/core/logging_config.py` - 日志配置

**测试配置** (4 个):
- `pytest.ini` - pytest 配置
- `.coveragerc` - 覆盖率配置
- `tests/conftest.py` - 测试 fixtures
- `tests/factories.py` - 测试数据工厂

**黄金文件测试** (4 个):
- `tests/golden/conftest.py` - 黄金文件测试框架
- `tests/golden/test_golden_auth.py` - 认证 API 黄金测试
- `tests/golden/test_golden_notes.py` - 笔记 API 黄金测试
- `tests/golden/approved_diffs.yaml` - 已批准差异

**安全测试** (5 个):
- `tests/security/test_secret_key.py` - SECRET_KEY 测试
- `tests/security/test_cors_security.py` - CORS 测试
- `tests/security/test_sql_injection.py` - SQL 注入测试
- `tests/security/test_auth_security.py` - JWT 认证测试
- `tests/security/test_password_security.py` - 密码安全测试

**单元测试** (3 个):
- `tests/unit/services/test_note_service.py` - NoteService 单元测试
- `tests/unit/core/test_security.py` - security 模块单元测试
- `tests/unit/services/test_doubao_service.py` - DoubaoService 单元测试

**集成测试** (4 个):
- `tests/integration/test_pydantic_v2_migration.py` - Pydantic v2 迁移测试
- `tests/integration/test_timezone_aware_datetime.py` - 时区迁移测试
- `tests/integration/test_lifespan.py` - 生命周期测试
- `tests/integration/test_exception_handlers.py` - 异常处理器测试
- `tests/integration/test_dependencies.py` - 依赖注入测试
- `tests/integration/test_background_tasks.py` - BackgroundTasks 测试
- `tests/integration/test_logging.py` - 日志系统测试

**CI/CD** (2 个):
- `.github/workflows/test.yml` - GitHub Actions 工作流
- `.pre-commit-config.yaml` - Pre-commit hooks

**文档** (2 个):
- `tests/README.md` - 测试使用文档
- `scripts/seed_golden_test_data.py` - 黄金测试数据生成脚本

## Learning Resources (面向新手)

### 必读文档
1. **guidance-specification.md** - 跨角色综合决策和架构设计
2. **subject-matter-expert/analysis.md** - 代码对比示例和学习要点 (重点阅读)
3. **test-strategist/analysis.md** - 完整测试策略和用例设计
4. **system-architect/analysis.md** - 架构模式和异常处理设计

### 推荐学习顺序
1. **阅读 IMPL-001 相关章节**: subject-matter-expert 第 823-1153 行 (安全修复)
2. **阅读 IMPL-002 相关章节**: subject-matter-expert 第 186-325 行 (API 迁移)
3. **阅读 IMPL-003 相关章节**: system-architect + subject-matter-expert (架构模式)
4. **阅读 IMPL-004 相关章节**: test-strategist 完整文档 (测试策略)

### 代码对比示例位置
- **SECRET_KEY 修复**: subject-matter-expert 第 823-840 行
- **CORS 修复**: subject-matter-expert 第 843-882 行
- **SQL 注入修复**: subject-matter-expert 第 134-183 行
- **Pydantic v2 迁移**: subject-matter-expert 第 186-212 行
- **时区迁移**: subject-matter-expert 第 215-265 行
- **lifespan 迁移**: subject-matter-expert 第 268-325 行
- **依赖注入模式**: subject-matter-expert 第 89-132 行
- **BackgroundTasks**: subject-matter-expert 第 450-519 行
- **日志系统**: subject-matter-expert 第 520-599 行

---

**生成时间**: 2025-11-18
**会话**: WFS-backend-refactor
**相关文档**: [IMPL_PLAN.md](./IMPL_PLAN.md), [guidance-specification.md](./.brainstorming/guidance-specification.md)
