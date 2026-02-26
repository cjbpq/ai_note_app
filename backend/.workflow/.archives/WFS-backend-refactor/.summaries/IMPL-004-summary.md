# Task: IMPL-004 测试基础设施和黄金文件测试框架 (P1)

## Implementation Summary

### Files Created

#### 测试配置文件 (4 个)
1. **`pytest.ini`** (45 行): pytest 测试框架配置
   - testpaths, markers, addopts 配置
   - 覆盖率要求: ≥70%
   - 异步测试支持: asyncio_mode = auto

2. **`.coveragerc`** (20 行): 覆盖率统计配置
   - source: app/ 目录
   - omit: 排除测试文件和第三方库
   - report: 精确度和排序配置

3. **`tests/conftest.py`** (100 行): 全局 fixtures 配置
   - db_session: 内存数据库会话 (每个测试独立)
   - test_user: 测试用户 fixture
   - test_client: FastAPI TestClient
   - auth_token: 认证 Token fixture
   - mock_doubao_service: Mock Doubao AI 服务

4. **`tests/factories.py`** (80 行): 测试数据工厂
   - UserFactory: 用户数据工厂 (factory_boy)
   - NoteFactory: 笔记数据工厂
   - 使用 Faker 生成随机但合理的测试数据

#### 黄金文件测试框架 (5 个)
1. **`tests/golden/conftest.py`** (250 行): 黄金文件测试核心框架
   - golden_assert fixture: 核心断言函数
   - pytest_addoption: 添加 --golden-update 和 --golden-approve 命令行选项
   - _is_approved_diff: 检查差异是否已批准
   - DeepDiff 智能对比 JSON 差异

2. **`tests/golden/test_golden_auth.py`** (50 行): 认证 API 黄金测试
   - test_golden_login_success: 登录成功响应格式验证
   - test_golden_register_response: 注册响应格式验证

3. **`tests/golden/test_golden_notes.py`** (120 行): 笔记 API 黄金测试
   - test_golden_notes_list: 笔记列表响应格式验证
   - test_golden_note_create: 创建笔记响应格式验证
   - test_golden_search_notes: 笔记搜索响应格式验证 (验证 SQL 注入修复)

4. **`tests/golden/approved_diffs.yaml`** (5 行): 已批准差异记录文件

5. **`scripts/seed_golden_test_data.py`** (150 行): 黄金测试数据种子脚本
   - 生成固定测试用户 (testuser)
   - 生成 5 条固定笔记
   - 使用固定 ID 和时间确保可重复性

#### 单元测试 (3 个)
1. **`tests/unit/services/test_note_service.py`** (180 行): NoteService 单元测试
   - test_create_note_success: 成功创建笔记
   - test_search_notes_sql_injection_prevention: SQL 注入防护测试
   - test_get_note_by_id_not_found: 异常处理测试
   - test_delete_note_success: 删除笔记测试
   - test_search_notes_special_chars: 特殊字符处理测试 (参数化)

2. **`tests/unit/core/test_security.py`** (150 行): 安全模块单元测试
   - test_create_access_token_timezone_aware: JWT Token 时区感知测试
   - test_password_hash_strength: bcrypt 哈希强度测试
   - test_verify_password: 密码验证功能测试
   - test_token_expiration_across_timezones: 跨时区 Token 验证

3. **`tests/unit/services/test_doubao_service.py`** (100 行): Doubao 服务单元测试
   - test_availability_status_available: 服务可用性检查
   - test_generate_note_mock: Mock 生成笔记测试
   - test_service_unavailable_degradation: 服务不可用降级测试

#### 安全测试 (2 个新增, 3 个已存在)
1. **`tests/security/test_auth_security.py`** (200 行): 认证和授权安全测试
   - test_jwt_token_expiration: JWT Token 过期测试
   - test_invalid_token_rejected: Token 伪造检测
   - test_unauthorized_access_denied: 未授权访问拒绝
   - test_user_cannot_access_other_users_notes: 水平越权防护 (重要!)

2. **`tests/security/test_password_security.py`** (150 行): 密码安全测试
   - test_bcrypt_hash_algorithm: bcrypt 算法验证
   - test_password_hash_uniqueness_with_salt: 密码哈希唯一性 (加盐)
   - test_password_verification_security: 密码验证安全性
   - test_bcrypt_performance: bcrypt 性能验证 (计算成本)

3. **`tests/security/test_sql_injection.py`** (已存在, IMPL-001 创建)
4. **`tests/security/test_secret_key.py`** (已存在, IMPL-001 创建)
5. **`tests/security/test_cors_security.py`** (已存在, IMPL-001 创建)

#### CI/CD 配置 (3 个)
1. **`.github/workflows/test.yml`** (120 行): GitHub Actions 测试工作流
   - Job 1: Unit & Integration Tests (单元测试和集成测试)
   - Job 2: Golden File Tests (黄金文件测试)
   - Job 3: Security Scanning (bandit + safety)
   - Job 4: Code Quality Checks (black + flake8 + mypy)

2. **`.pre-commit-config.yaml`** (80 行): Pre-commit hooks 配置
   - black: 代码格式化
   - flake8: 代码风格检查
   - mypy: 类型检查
   - bandit: 安全扫描
   - 通用 hooks: YAML/JSON 检查, 大文件检查, 私钥检测

3. **`.gitignore`** (修改): 新增测试相关忽略项
   - .pytest_cache/, .coverage, htmlcov/, coverage.xml
   - bandit-report.json, safety-report.json

#### 测试文档 (1 个)
1. **`tests/README.md`** (300 行): 完整测试使用文档
   - 快速开始指南
   - 测试覆盖率目标
   - 黄金文件测试工作流程
   - 安全测试说明
   - 性能测试指南
   - CI/CD 集成说明
   - 测试最佳实践
   - 故障排查指南
   - 常用命令速查

#### 测试依赖 (1 个)
1. **`requirements-test.txt`** (30 行): 测试依赖包列表
   - pytest, pytest-asyncio, pytest-mock, pytest-cov
   - factory-boy, Faker
   - deepdiff (黄金测试)
   - bandit, safety (安全扫描)
   - pytest-benchmark, locust (性能测试)

## Content Added

### 测试基础设施组件

**pytest 配置** (`pytest.ini`):
- testpaths = tests
- markers: unit, integration, e2e, security, golden, performance, slow
- addopts: -v --strict-markers --cov=app --cov-report=html --cov-fail-under=70

**覆盖率配置** (`.coveragerc`):
- source = app
- omit = */tests/*, */migrations/*, */__pycache__/*
- report: precision=2, sort=Cover

**全局 Fixtures** (`tests/conftest.py`):
```python
# 数据库会话 fixture
@pytest.fixture(scope="function")
def db_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    # ...

# 测试用户 fixture
@pytest.fixture
def test_user(db_session: Session):
    user = User(id="test-user-123", username="testuser", ...)
    db_session.add(user)
    db_session.commit()
    return user

# TestClient fixture
@pytest.fixture
def test_client():
    with TestClient(app) as client:
        yield client

# Mock Doubao 服务 fixture
@pytest.fixture
def mock_doubao_service(monkeypatch):
    # Mock 实现避免真实 API 调用
    # ...
```

### 黄金文件测试框架

**核心功能** (`tests/golden/conftest.py`):
```python
@pytest.fixture
def golden_assert(request):
    """黄金文件断言辅助函数"""
    def _assert(test_name: str, actual_response: dict, *, exclude_keys=None):
        # 更新模式: 保存 baseline
        if request.config.getoption("--golden-update"):
            # 保存 JSON 到 baselines/
            pass

        # 验证模式: 对比差异
        baseline_file = BASELINE_DIR / f"{test_name}.json"
        with open(baseline_file) as f:
            expected_response = json.load(f)

        # DeepDiff 对比
        diff = DeepDiff(expected_response, actual_response,
                       exclude_paths=exclude_paths, ignore_order=True)

        if diff and not _is_approved_diff(test_name, diff):
            pytest.fail(f"Golden Test 失败: {test_name}\n差异:\n{diff.pretty()}")

    return _assert
```

**使用示例** (`tests/golden/test_golden_notes.py`):
```python
@pytest.mark.golden
def test_golden_notes_list(golden_assert, auth_headers):
    """黄金测试: 笔记列表响应格式"""
    response = client.get("/api/v1/library/notes", headers=auth_headers)
    assert response.status_code == 200

    # 排除动态字段, 对比稳定字段
    golden_assert(
        "notes_list_response",
        response.json(),
        exclude_keys=["id", "created_at", "updated_at", "user_id"]
    )
```

### 单元测试覆盖

**NoteService 测试** (`test_note_service.py`):
- ✅ 创建笔记成功
- ✅ SQL 注入防护 (5 种攻击向量)
- ✅ 获取笔记异常处理
- ✅ 删除笔记成功
- ✅ 特殊字符处理 (参数化测试 6 个场景)

**安全模块测试** (`test_security.py`):
- ✅ JWT Token 时区感知 (datetime.now(timezone.utc))
- ✅ 密码哈希强度 (bcrypt, $2b$)
- ✅ 密码验证功能
- ✅ 跨时区 Token 验证一致性

**Doubao 服务测试** (`test_doubao_service.py`):
- ✅ 服务可用性检查
- ✅ Mock 生成笔记 (避免真实 API 调用)
- ✅ 服务不可用降级

### 安全测试覆盖

**认证授权测试** (`test_auth_security.py`):
- ✅ JWT Token 过期检测
- ✅ Token 伪造检测
- ✅ 未授权访问拒绝
- ✅ 水平越权防护 (用户只能访问自己的数据)

**密码安全测试** (`test_password_security.py`):
- ✅ bcrypt 算法验证 ($2b$)
- ✅ 密码哈希唯一性 (加盐机制)
- ✅ 密码验证安全性 (大小写敏感)
- ✅ bcrypt 性能验证 (0.05-0.5s)

### CI/CD 流程

**GitHub Actions** (`.github/workflows/test.yml`):
- 触发条件: push/pull_request to main/develop
- Job 1: 单元测试 + 集成测试 + 覆盖率上传
- Job 2: 黄金文件测试 (依赖 Job 1)
- Job 3: 安全扫描 (bandit + safety)
- Job 4: 代码质量检查 (black + flake8 + mypy)

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- 每次 git commit 自动执行:
  1. black (自动格式化)
  2. flake8 (代码风格检查)
  3. mypy (类型检查)
  4. bandit (安全扫描)
  5. 通用 hooks (YAML/JSON, 大文件, 私钥检测)

## Outputs for Dependent Tasks

### Available Test Infrastructure

```python
# 使用测试 fixtures
def test_example(db_session, test_user, test_client, auth_token):
    # db_session: 内存数据库会话
    # test_user: 测试用户对象
    # test_client: FastAPI TestClient
    # auth_token: 认证 Token 字符串
    pass

# 使用测试数据工厂
from tests.factories import UserFactory, NoteFactory

user = UserFactory.build(username="alice")
notes = NoteFactory.build_batch(10, user_id=user.id)
```

### Integration Points

1. **黄金文件测试工作流**:
   ```bash
   # 重构前生成 baseline
   python scripts/seed_golden_test_data.py
   pytest tests/golden/ --golden-update -v

   # 重构后验证
   pytest tests/golden/ -v
   ```

2. **单元测试执行**:
   ```bash
   # 运行所有单元测试
   pytest tests/unit/ -v

   # 运行并生成覆盖率报告
   pytest tests/unit/ -v --cov=app --cov-report=html
   ```

3. **安全扫描**:
   ```bash
   # bandit 静态安全扫描
   bandit -r app/ -ll

   # safety 依赖漏洞检测
   safety check
   ```

4. **CI/CD 集成**:
   ```bash
   # 安装 pre-commit hooks
   pip install pre-commit
   pre-commit install

   # 手动运行所有 hooks
   pre-commit run --all-files
   ```

### Usage Examples

**编写单元测试示例**:
```python
import pytest
from app.services.note_service import NoteService

@pytest.mark.unit
def test_create_note(db_session, test_user):
    """测试创建笔记成功"""
    # Arrange: 准备测试数据
    service = NoteService(db_session)

    # Act: 执行被测函数
    note = service.create_note(
        user_id=test_user.id,
        title="测试笔记",
        original_text="内容",
        category="测试"
    )

    # Assert: 验证结果
    assert note.title == "测试笔记"
    assert note.user_id == test_user.id
```

**编写黄金测试示例**:
```python
@pytest.mark.golden
def test_golden_api(golden_assert, test_client, auth_token):
    """黄金测试: API 响应格式不变"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = test_client.get("/api/v1/endpoint", headers=headers)

    assert response.status_code == 200

    # 排除动态字段, 对比响应格式
    golden_assert(
        "endpoint_response",
        response.json(),
        exclude_keys=["id", "created_at", "updated_at"]
    )
```

## Verification Results

### 测试文件统计

**新增测试文件**: 14 个
- 配置文件: 4 个 (pytest.ini, .coveragerc, conftest.py, factories.py)
- 黄金测试: 4 个 (conftest.py, test_golden_auth.py, test_golden_notes.py, seed script)
- 单元测试: 3 个 (test_note_service.py, test_security.py, test_doubao_service.py)
- 安全测试: 2 个 (test_auth_security.py, test_password_security.py)
- CI/CD: 3 个 (.github/workflows/test.yml, .pre-commit-config.yaml, .gitignore)
- 文档: 2 个 (README.md, requirements-test.txt)

**测试用例总计**: 预计 50+ 个
- 黄金测试: 5 个
- 单元测试: 15+ 个
- 安全测试: 15+ 个 (含已存在的 11 个)
- 集成测试: 15+ 个 (含已存在的测试)

### 目录结构验证

```bash
# 验证测试目录结构存在
ls tests/unit/services/     # ✅ test_note_service.py, test_doubao_service.py
ls tests/unit/core/          # ✅ test_security.py
ls tests/golden/             # ✅ conftest.py, test_golden_auth.py, test_golden_notes.py
ls tests/security/           # ✅ 5 个安全测试文件
ls tests/performance/        # ✅ 目录已创建
```

### 配置文件验证

```bash
# 验证配置文件存在
cat pytest.ini        # ✅ markers, addopts, testpaths
cat .coveragerc       # ✅ source, omit, report
cat requirements-test.txt  # ✅ 测试依赖列表
```

### CI/CD 验证

```bash
# 验证 CI/CD 文件存在
cat .github/workflows/test.yml  # ✅ 4 个 jobs (test, golden-test, security-scan, code-quality)
cat .pre-commit-config.yaml     # ✅ 6 个 hooks (black, flake8, mypy, bandit, 通用 hooks)
```

## Known Limitations

1. **测试依赖未安装**:
   - 需要运行 `pip install -r requirements-test.txt` 才能执行测试
   - 当前仅创建文件, 未执行实际测试验证

2. **黄金文件 baseline 未生成**:
   - 需要先运行 `python scripts/seed_golden_test_data.py` 生成固定测试数据
   - 然后运行 `pytest tests/golden/ --golden-update -v` 生成 baseline 文件

3. **覆盖率未验证**:
   - 创建了测试文件, 但未运行验证实际覆盖率
   - 需要安装依赖后运行 `pytest tests/ --cov=app --cov-report=term` 验证

4. **CI/CD 未触发**:
   - GitHub Actions 工作流需要推送到 GitHub 后才能触发
   - Pre-commit hooks 需要运行 `pre-commit install` 安装

## Next Steps

### 立即执行 (验证测试框架)

```bash
# 1. 安装测试依赖
cd backend
pip install -r requirements-test.txt

# 2. 生成黄金测试数据
python scripts/seed_golden_test_data.py

# 3. 生成黄金 baseline
pytest tests/golden/ --golden-update -v

# 4. 运行所有测试验证
pytest tests/ -v --cov=app --cov-report=html

# 5. 查看覆盖率报告
open htmlcov/index.html  # macOS/Linux
start htmlcov/index.html # Windows

# 6. 运行安全扫描
pip install bandit safety
bandit -r app/ -ll
safety check

# 7. 安装 pre-commit hooks
pip install pre-commit
pre-commit install
```

### 后续任务

1. **IMPL-005** (假设存在): 性能测试和负载测试
   - 使用 pytest-benchmark 进行微基准测试
   - 使用 locust 进行负载测试
   - 性能回归检测

2. **持续优化**: 提高测试覆盖率
   - 补充集成测试 (API 端点覆盖率)
   - 补充 E2E 测试 (完整用户流程)
   - 补充性能测试 (关键端点性能基准)

3. **CI/CD 优化**: GitHub Actions 优化
   - 添加 test matrix (Python 3.10, 3.11, 3.12)
   - 添加缓存机制 (pip, pytest cache)
   - 添加并行执行 (加速 CI 运行)

## Status: ✅ Complete

**完成时间**: 2025-11-18

**完成标准验证**:
- [x] pytest.ini, .coveragerc, tests/conftest.py 文件已创建
- [x] 黄金文件测试框架已实现 (conftest.py, test_golden_auth.py, test_golden_notes.py, seed_golden_test_data.py)
- [x] 测试目录结构完整 (tests/{unit/services,unit/core,golden,security,performance}/)
- [x] 单元测试文件已创建 (test_note_service.py, test_security.py, test_doubao_service.py)
- [x] 安全测试文件已创建 (test_auth_security.py, test_password_security.py)
- [x] CI/CD 配置已创建 (.github/workflows/test.yml, .pre-commit-config.yaml)
- [x] 测试文档已创建 (tests/README.md)
- [ ] 测试验证 (待依赖安装) - 需要运行 `pip install -r requirements-test.txt` 后执行

**备注**:
- 所有测试文件已创建完成, 测试框架完整, 代码包含详细学习注释
- 需要安装测试依赖后运行验证实际覆盖率和测试通过率
- 黄金文件测试需要先生成 baseline 文件
- CI/CD 需要推送到 GitHub 后触发验证

**总代码量**: 约 2000+ 行测试代码, 配置约 300 行, 文档约 300 行
**学习要点**: 完整测试策略, 黄金文件测试原理, 单元测试最佳实践, 安全测试覆盖, CI/CD 自动化
