# 测试文档

## 概述

本项目实现了完整的测试基础设施, 包括单元测试、集成测试、黄金文件测试和安全测试。

## 目录结构

```
tests/
├── conftest.py                    # pytest 全局配置和共享 fixtures
├── factories.py                   # 测试数据工厂 (factory_boy)
├── unit/                          # 单元测试 (60% 目标)
│   ├── services/                  # 服务层测试
│   │   ├── test_note_service.py
│   │   └── test_doubao_service.py
│   └── core/                      # 核心模块测试
│       └── test_security.py
├── integration/                   # 集成测试 (30% 目标)
│   ├── test_pydantic_v2_migration.py
│   ├── test_lifespan.py
│   └── ...
├── golden/                        # 黄金文件测试 (重构验证)
│   ├── conftest.py                # 黄金测试框架
│   ├── baselines/                 # 黄金基准文件 (JSON)
│   ├── approved_diffs.yaml        # 已批准的差异
│   ├── test_golden_auth.py
│   └── test_golden_notes.py
├── security/                      # 安全测试
│   ├── test_sql_injection.py
│   ├── test_secret_key.py
│   ├── test_cors_security.py
│   ├── test_auth_security.py
│   └── test_password_security.py
└── performance/                   # 性能测试 (可选)
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
pip install -r requirements-test.txt
```

### 2. 运行所有测试

```bash
# 运行完整测试套件
pytest tests/ -v

# 运行并生成覆盖率报告
pytest tests/ -v --cov=app --cov-report=html

# 查看 HTML 覆盖率报告
open htmlcov/index.html  # macOS/Linux
start htmlcov/index.html # Windows
```

### 3. 按类型运行测试

```bash
# 单元测试 (快速)
pytest tests/unit/ -v

# 集成测试
pytest tests/integration/ -v

# 黄金文件测试
pytest tests/golden/ -v

# 安全测试
pytest tests/security/ -v

# 使用 markers 运行
pytest -m unit -v        # 仅单元测试
pytest -m security -v    # 仅安全测试
```

## 测试覆盖率目标

- **总体覆盖率**: ≥ 70%
- **服务层覆盖率**: ≥ 80%
- **核心模块覆盖率**: ≥ 90%

### 当前覆盖率

运行以下命令查看当前覆盖率:

```bash
pytest tests/ --cov=app --cov-report=term-missing
```

## 黄金文件测试

### 用途

黄金文件测试 (Golden Testing) 用于验证重构后 API 行为不变。

### 工作流程

#### 1. 重构前生成 baseline

```bash
# 先运行种子脚本生成固定测试数据
python scripts/seed_golden_test_data.py

# 生成黄金基准文件
pytest tests/golden/ --golden-update -v
```

生成的 baseline 文件位于 `tests/golden/baselines/*.json`, 应提交到版本控制。

#### 2. 重构中验证

执行代码重构后:

```bash
pytest tests/golden/ -v
```

- ✅ 通过: API 行为未变, 重构成功
- ❌ 失败: 发现差异, 需检查是否为意外变更

#### 3. 处理差异

如果测试失败:

1. **意外差异**: 修复代码, 确保行为一致
2. **预期差异** (如性能优化): 批准差异

```bash
# 批准差异 (慎用!)
pytest tests/golden/ --golden-approve
```

### 排除动态字段

黄金测试会自动排除动态字段 (id, created_at, updated_at), 仅对比稳定字段。

## 安全测试

### 覆盖范围

- **SQL 注入防护**: 验证 ORM 参数化查询
- **SECRET_KEY 安全**: 验证无硬编码
- **CORS 配置**: 验证白名单限制
- **JWT Token 安全**: 验证过期和签名验证
- **密码安全**: 验证 bcrypt 哈希强度

### 运行安全测试

```bash
# 运行所有安全测试
pytest tests/security/ -v

# 运行 bandit 静态扫描
bandit -r app/ -ll

# 检查依赖漏洞
safety check
```

### 安全质量门禁

- bandit 扫描: 0 个 High 风险
- safety 检查: 0 个已知 CVE
- 所有安全测试: 100% 通过

## 性能测试

### 微基准测试

```bash
pytest tests/performance/ --benchmark-only
```

### 负载测试

```bash
# 需要先安装 locust
pip install locust

# 运行负载测试
locust -f tests/performance/locustfile.py --host=http://localhost:8000
```

## CI/CD 集成

### GitHub Actions

每次 PR 或推送到 main/develop 分支会自动触发:

1. **单元测试和集成测试**
2. **黄金文件测试**
3. **安全扫描** (bandit + safety)
4. **代码质量检查** (black + flake8 + mypy)

查看工作流: `.github/workflows/test.yml`

### Pre-commit Hooks

安装 pre-commit hooks:

```bash
pip install pre-commit
pre-commit install
```

每次 `git commit` 会自动执行:

- black (代码格式化)
- flake8 (代码风格检查)
- mypy (类型检查)
- bandit (安全扫描)

## 测试最佳实践

### 1. 测试命名

```python
# ✅ 好的命名: test_<function>_<scenario>
def test_create_note_success():
    pass

def test_create_note_invalid_user():
    pass

# ❌ 差的命名
def test1():
    pass

def test_note():
    pass
```

### 2. AAA 模式

```python
def test_search_notes():
    # Arrange: 准备测试数据
    service = NoteService(db_session)
    note = service.create_note(...)

    # Act: 执行被测函数
    results = service.search_notes(user_id="test", query="关键词")

    # Assert: 验证结果
    assert len(results) == 1
    assert results[0].title == note.title
```

### 3. 使用 Fixtures

```python
# 使用共享 fixtures 避免重复代码
def test_with_user(test_user, db_session):
    # test_user fixture 自动创建测试用户
    assert test_user.username == "testuser"
```

### 4. 参数化测试

```python
@pytest.mark.parametrize("special_char", ["%", "_", "'", '"', "--"])
def test_special_chars(special_char):
    # 一个测试覆盖多个场景
    results = search_notes(query=special_char)
    assert isinstance(results, list)
```

### 5. Mock 外部服务

```python
def test_doubao_service(mock_doubao_service):
    # mock_doubao_service fixture 自动替换真实服务
    result = doubao_service.generate_structured_note("文本")
    assert "note" in result
```

## 测试数据管理

### 使用 Factories

```python
from tests.factories import UserFactory, NoteFactory

# 创建测试用户
user = UserFactory.build(username="alice")

# 批量创建笔记
notes = NoteFactory.build_batch(10, user_id=user.id)
```

### 固定测试数据

黄金测试使用固定种子数据确保可重复性:

```bash
python scripts/seed_golden_test_data.py
```

## 故障排查

### 测试失败

1. 查看详细错误信息: `pytest -v --tb=long`
2. 运行单个测试: `pytest tests/unit/test_note_service.py::test_create_note -v`
3. 添加断点调试: 在代码中添加 `import pdb; pdb.set_trace()`

### 覆盖率不达标

1. 查看未覆盖代码: `pytest --cov=app --cov-report=term-missing`
2. 生成 HTML 报告: `pytest --cov=app --cov-report=html`
3. 补充测试用例覆盖未测试分支

### 黄金测试差异

1. 查看差异详情: 测试输出会显示 DeepDiff 对比结果
2. 确认是否为预期变更
3. 如果是意外变更: 修复代码
4. 如果是预期变更: `pytest tests/golden/ --golden-approve`

## 常用命令速查

```bash
# 快速测试 (仅单元测试)
pytest tests/unit/ -v -x

# 完整测试 + 覆盖率
pytest tests/ -v --cov=app --cov-report=html

# 黄金测试生成 baseline
pytest tests/golden/ --golden-update -v

# 安全扫描
bandit -r app/ -ll
safety check

# Pre-commit 检查
pre-commit run --all-files

# 性能基准测试
pytest tests/performance/ --benchmark-only
```

## 学习资源

- [pytest 文档](https://docs.pytest.org/)
- [factory_boy 文档](https://factoryboy.readthedocs.io/)
- [bandit 文档](https://bandit.readthedocs.io/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

## 联系方式

如有测试相关问题, 请联系测试负责人或查阅项目 Wiki。
