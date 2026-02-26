"""测试 SQL 注入防护

验证 search_notes 方法使用 ORM 参数化查询, 防止 SQL 注入攻击
"""
import pytest
from sqlalchemy.orm import Session
from app.services.note_service import NoteService
from app.models.note import Note
from app.database import SessionLocal


@pytest.fixture
def db_session():
    """测试数据库会话"""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def test_user_id():
    """测试用户 ID"""
    return "test-user-sql-injection"


@pytest.fixture
def setup_test_notes(db_session, test_user_id):
    """创建测试笔记数据"""
    note_service = NoteService(db_session)

    # 创建测试笔记
    test_notes = [
        {"title": "正常笔记", "original_text": "这是正常的笔记内容"},
        {"title": "学习笔记", "original_text": "Python SQL 注入防护"},
        {"title": "工作笔记", "original_text": "安全编程最佳实践"},
    ]

    created_notes = []
    for note_data in test_notes:
        note = note_service.create_note(note_data, test_user_id)
        created_notes.append(note)

    yield created_notes

    # 清理测试数据
    for note in created_notes:
        db_session.delete(note)
    db_session.commit()


def test_search_notes_prevents_drop_table(db_session, test_user_id, setup_test_notes):
    """测试: 防止 DROP TABLE 注入攻击

    攻击向量: '; DROP TABLE notes;--
    预期行为: 查询返回空结果或无匹配, 数据库表未被删除
    """
    note_service = NoteService(db_session)

    # SQL 注入攻击: 尝试删除 notes 表
    malicious_query = "'; DROP TABLE notes;--"

    # 执行搜索 (应该安全处理, 不��出异常)
    result = note_service.search_notes(test_user_id, malicious_query)

    # 验证: 返回空列表 (无匹配) 或安全处理
    assert isinstance(result, list)

    # 验证: 数据库表未被删除 (能查询到之前的笔记)
    all_notes = note_service.get_user_notes(test_user_id)
    assert len(all_notes) > 0, "数据库表不应被删除"


def test_search_notes_prevents_union_select(db_session, test_user_id, setup_test_notes):
    """测试: 防止 UNION SELECT 注入攻击

    攻击向量: ' UNION SELECT * FROM users--
    预期行为: 查询返回空结果或无匹配, 不泄露其他表数据
    """
    note_service = NoteService(db_session)

    # SQL 注入攻击: 尝试通过 UNION 查询其他表
    malicious_query = "' UNION SELECT * FROM users--"

    result = note_service.search_notes(test_user_id, malicious_query)

    # 验证: 返回的是 Note 对象列表 (不是其他表数据)
    assert isinstance(result, list)
    for item in result:
        assert isinstance(item, Note), "返回结果应为 Note 对象, 不应泄露其他表数据"


def test_search_notes_prevents_update_injection(db_session, test_user_id, setup_test_notes):
    """测试: 防止 UPDATE 注入攻击

    攻击向量: '; UPDATE notes SET user_id='attacker';--
    预期行为: 查询不应修改数据库数据
    """
    note_service = NoteService(db_session)

    # 记录原始笔记的 user_id
    original_notes = note_service.get_user_notes(test_user_id)
    original_user_ids = {note.id: note.user_id for note in original_notes}

    # SQL 注入攻击: 尝试修改笔记的 user_id
    malicious_query = "'; UPDATE notes SET user_id='attacker';--"

    result = note_service.search_notes(test_user_id, malicious_query)

    # 验证: 笔记的 user_id 未被修改
    updated_notes = note_service.get_user_notes(test_user_id)
    for note in updated_notes:
        assert note.user_id == original_user_ids[note.id], "笔记 user_id 不应被修改"


def test_search_notes_special_chars(db_session, test_user_id, setup_test_notes):
    """测试: 特殊字符处理

    验证: 包含特殊 SQL 字符的正常查询能正确工作
    """
    note_service = NoteService(db_session)

    # 包含特殊字符的查询 (%, _, ', ")
    special_queries = [
        "%",       # SQL 通配符
        "_",       # SQL 通配符
        "'",       # SQL 字符串分隔符
        "\"",      # SQL 字符串分隔符
        "' OR '1'='1",  # 常见注入模式
    ]

    for query in special_queries:
        # 应该安全处理, 不抛出异常
        result = note_service.search_notes(test_user_id, query)
        assert isinstance(result, list), f"查询 '{query}' 应返回列表"


def test_database_integrity_after_injection_attempt(db_session, test_user_id, setup_test_notes):
    """测试: 注入攻击后数据库完整性验证

    验证: 多次注入攻击后, 数据库结构和数据完整
    """
    note_service = NoteService(db_session)

    # 执行多种注入攻击
    injection_patterns = [
        "'; DROP TABLE notes;--",
        "' OR '1'='1",
        "'; DELETE FROM notes WHERE 1=1;--",
        "' UNION SELECT NULL--",
        "admin'--",
    ]

    for pattern in injection_patterns:
        try:
            note_service.search_notes(test_user_id, pattern)
        except Exception:
            pass  # 即使抛出异常, 也不应破坏数据库

    # 验证: 数据库表仍然存在, 数据完整
    all_notes = note_service.get_user_notes(test_user_id)
    assert len(all_notes) >= 3, "数据库应包含原始测试笔记"

    # 验证: 可以正常创建新笔记
    new_note = note_service.create_note(
        {"title": "测试笔记", "original_text": "验证数据库完整性"},
        test_user_id
    )
    assert new_note.id is not None, "应能正常创建新笔记"

    # 清理新笔记
    db_session.delete(new_note)
    db_session.commit()
