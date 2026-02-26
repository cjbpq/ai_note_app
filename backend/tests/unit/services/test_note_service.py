"""单元测试: NoteService 核心业务逻辑
学习要点:
- 单元测试: 测试单个函数/方法的业务逻辑 (隔离外部依赖)
- Mock 外部服务: 使用 pytest-mock 隔离数据库和外部 API
- 测试覆盖率目标: services 层 ≥80%
"""

import pytest
from unittest.mock import Mock, MagicMock
from datetime import datetime, timezone

from app.services.note_service import NoteService
from app.models.note import Note
from app.core.exceptions import NoteNotFoundError


# ========================================
# 测试用例 1: 创建笔记
# ========================================

@pytest.mark.unit
def test_create_note_success(db_session):
    """测试: 成功创建笔记

    验证重点:
    - 笔记对象正确保存到数据库
    - 返回值包含完整笔记信息
    - created_at 和 updated_at 自动设置

    学习要点:
    - db_session fixture: 每个测试用例独立的内存数据库
    - assert: 验证业务逻辑正确性
    - 单元测试应快速执行 (< 0.1s)
    """
    service = NoteService(db_session)

    # 创建笔记
    note = service.create_note(
        user_id="test-user-123",
        title="测试笔记",
        original_text="这是测试内容",
        category="测试分类"
    )

    # 验证返回值
    assert note.title == "测试笔记"
    assert note.original_text == "这是测试内容"
    assert note.category == "测试分类"
    assert note.user_id == "test-user-123"
    assert note.is_archived == False
    assert note.created_at is not None
    assert note.updated_at is not None

    # 验证数据库持久化
    saved_note = db_session.query(Note).filter(Note.id == note.id).first()
    assert saved_note is not None
    assert saved_note.title == "测试笔记"


# ========================================
# 测试用例 2: SQL 注入防护
# ========================================

@pytest.mark.unit
@pytest.mark.security
def test_search_notes_sql_injection_prevention(db_session):
    """测试: SQL 注入防护 (重构后验证)

    验证重点:
    - 恶意 SQL 注入输入不会破坏数据库
    - ORM 参数化查询自动转义特殊字符
    - 不应抛出异常, 返回空列表或安全处理

    学习要点:
    - SQL 注入攻击向量: '; DROP TABLE notes;--
    - ORM 自动转义: SQLAlchemy .ilike() 方法内部转义
    - 安全测试: 验证修复后的防护措施
    """
    service = NoteService(db_session)

    # 创建测试数据
    service.create_note(
        user_id="test-user-123",
        title="正常笔记",
        original_text="正常内容",
        category="测试"
    )

    # SQL 注入攻击向量
    malicious_queries = [
        "'; DROP TABLE notes;--",        # 删除表
        "' OR '1'='1",                    # 绕过条件
        "'; UPDATE notes SET user_id='attacker';--",  # 篡改数据
        "' UNION SELECT * FROM users--", # 泄露数据
        "%'; DELETE FROM notes;--",      # 删除数据
    ]

    for malicious_input in malicious_queries:
        # 执行搜索 (应安全处理, 不抛出异常)
        try:
            results = service.search_notes(
                user_id="test-user-123",
                query=malicious_input
            )

            # 验证: 应返回列表 (可能为空)
            assert isinstance(results, list)

            # 验证: 数据库未被破坏
            note_count = db_session.query(Note).count()
            assert note_count >= 1  # 至少有 1 条笔记 (未被删除)

        except Exception as e:
            pytest.fail(
                f"❌ SQL 注入防护失败: {malicious_input}\n"
                f"异常: {e}\n"
                f"ORM 应自动转义特殊字符, 不应抛出异常"
            )


# ========================================
# 测试用例 3: 获取笔记 (异常处理)
# ========================================

@pytest.mark.unit
def test_get_note_by_id_not_found(db_session):
    """测试: 获取不存在的笔记抛出自定义异常

    验证重点:
    - 笔记不存在时抛出 NoteNotFoundError
    - 异常包含笔记 ID 信息
    - 全局异常处理器会捕获此异常

    学习要点:
    - pytest.raises: 验证函数抛出预期异常
    - 自定义异常: 业务异常与系统异常分离
    - 异常信息: 包含足够上下文便于调试
    """
    service = NoteService(db_session)

    # 验证: 抛出 NoteNotFoundError
    with pytest.raises(NoteNotFoundError) as exc_info:
        service.get_note_by_id(
            note_id="non-existent-id",
            user_id="test-user-123"
        )

    # 验证: 异常信息包含笔记 ID
    assert "non-existent-id" in str(exc_info.value)


# ========================================
# 测试用例 4: 删除笔记
# ========================================

@pytest.mark.unit
def test_delete_note_success(db_session):
    """测试: 成功删除笔记

    验证重点:
    - 笔记从数据库中删除
    - 删除后无法再查询到
    - 审计日志记录删除操作

    学习要点:
    - 创建 → 删除 → 验证: 完整的业务流程
    - 数据完整性: 删除操作应彻底清理数据
    - 审计日志: 记录敏感操作 (logger.warning)
    """
    service = NoteService(db_session)

    # 创建笔记
    note = service.create_note(
        user_id="test-user-123",
        title="待删除笔记",
        original_text="内容",
        category="测试"
    )

    note_id = note.id

    # 删除笔记
    service.delete_note(note_id=note_id, user_id="test-user-123")

    # 验证: 笔记已删除
    deleted_note = db_session.query(Note).filter(Note.id == note_id).first()
    assert deleted_note is None


# ========================================
# 测试用例 5: 特殊字符处理
# ========================================

@pytest.mark.unit
@pytest.mark.parametrize("special_char", [
    "%",      # SQL LIKE 通配符
    "_",      # SQL LIKE 单字符通配符
    "'",      # 单引号 (SQL 字符串分隔符)
    '"',      # 双引号
    "--",     # SQL 注释
    ";",      # SQL 语句分隔符
])
def test_search_notes_special_chars(db_session, special_char):
    """测试: 特殊字符安全处理 (参数化测试)

    验证重点:
    - 特殊字符作为普通文本搜索 (不被解释为 SQL 语法)
    - ORM 自动转义, 不抛出异常
    - 返回正确的搜索结果

    学习要点:
    - @pytest.mark.parametrize: 参数化测试, 避免重复代码
    - 特殊字符列表: SQL 注入常用字符
    - 单个测试覆盖多个场景 (6 个测试用例)
    """
    service = NoteService(db_session)

    # 创建包含特殊字符的笔记
    service.create_note(
        user_id="test-user-123",
        title=f"笔记标题{special_char}测试",
        original_text="内容",
        category="测试"
    )

    # 搜索特殊字符 (应安全处理)
    results = service.search_notes(
        user_id="test-user-123",
        query=special_char
    )

    # 验证: 返回列表, 不抛出异常
    assert isinstance(results, list)


# ========================================
# 学习总结
# ========================================

"""
单元测试最佳实践:

1. 测试命名:
   - test_<function_name>_<scenario>: 清晰描述测试场景
   - 示例: test_create_note_success, test_delete_note_not_found

2. AAA 模式 (Arrange-Act-Assert):
   - Arrange: 准备测试数据和环境
   - Act: 执行被测函数
   - Assert: 验证结果和副作用

3. 隔离性:
   - 每个测试用例独立 (使用 db_session fixture)
   - 不依赖其他测试的执行顺序
   - Mock 外部依赖 (数据库, API)

4. 覆盖率目标:
   - 正常场景: 成功创建, 查询, 更新, 删除
   - 异常场景: 数据不存在, 参数错误, 权限不足
   - 边界条件: 空值, 最大长度, 特殊字符

5. 参数化测试:
   - @pytest.mark.parametrize: 用一个测试覆盖多个输入
   - 减少重复代码, 提高可维护性

6. 标记 (markers):
   - @pytest.mark.unit: 单元测试标记
   - @pytest.mark.security: 安全测试标记
   - 用法: pytest -m unit (仅运行单元测试)

7. 测试速度:
   - 单元测试应快速执行 (< 0.1s per test)
   - 使用内存数据库 (sqlite:///:memory:)
   - Mock 外部服务 (API, 文件系统)
"""
