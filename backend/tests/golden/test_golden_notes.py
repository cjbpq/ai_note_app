"""黄金文件测试: 笔记相关 API
学习要点:
- 验证笔记 CRUD 操作响应格式不变
- 排除动态字段 (id, created_at, updated_at, user_id)
- 重构后 API 行为一致性保护
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


@pytest.fixture
def auth_headers():
    """获取认证 headers (用于受保护端点)"""
    # 登录获取 token
    response = client.post("/api/v1/auth/login", json={
        "username": "testuser",
        "password": "TestPassword123"
    })
    token = response.json()["access_token"]

    return {"Authorization": f"Bearer {token}"}


@pytest.mark.golden
def test_golden_notes_list(golden_assert, auth_headers):
    """黄金测试: 笔记列表响应格式

    验证重点:
    - 响应状态码 200
    - 列表字段: items, total, page, page_size
    - 单个笔记字段格式不变

    学习要点:
    - 排除 id, created_at, updated_at: 动态生成字段
    - ignore_order=True: 列表顺序可能不同 (由 DeepDiff 自动处理)
    """
    response = client.get("/api/v1/library/notes", headers=auth_headers)

    assert response.status_code == 200

    # 黄金断言
    golden_assert(
        "notes_list_response",
        response.json(),
        exclude_keys=["id", "created_at", "updated_at", "user_id"]
    )


@pytest.mark.golden
def test_golden_note_create(golden_assert, auth_headers):
    """黄金测试: 创建笔记响应格式

    验证重点:
    - 响应状态码 201
    - 返回完整笔记对象
    - 字段格式和类型不变

    学习要点:
    - 使用固定内容创建笔记确保可重复性
    - 排除所有动态生成字段
    """
    response = client.post(
        "/api/v1/library/notes",
        headers=auth_headers,
        json={
            "title": "Golden Test 笔记",
            "original_text": "这是黄金测试的固定内容",
            "category": "测试分类"
        }
    )

    assert response.status_code == 201

    # 黄金断言
    golden_assert(
        "note_create_response",
        response.json(),
        exclude_keys=["id", "created_at", "updated_at", "user_id", "device_id"]
    )


@pytest.mark.golden
def test_golden_search_notes(golden_assert, auth_headers):
    """黄金测试: 笔记搜索响应格式 (验证 SQL 注入修复不改变行为)

    验证重点:
    - SQL 注入防护修复后, 正常查询响应不变
    - 特殊字符查询安全处理, 不抛出异常
    - 响应格式保持一致

    学习要点:
    - 正常查询: 验证常规搜索行为
    - 特殊字符查询: 验证安全修复后的错误处理
    - 两种场景都应返回标准格式响应
    """
    # 测试 1: 正常查询
    response = client.get(
        "/api/v1/library/notes/search?q=测试",
        headers=auth_headers
    )

    assert response.status_code == 200

    golden_assert(
        "search_notes_normal",
        response.json(),
        exclude_keys=["id", "created_at", "updated_at", "user_id"]
    )

    # 测试 2: 特殊字符查询 (验证安全修复)
    # SQL 注入尝试: '; DROP TABLE notes;--
    response = client.get(
        "/api/v1/library/notes/search?q=%27%20OR%201=1--",
        headers=auth_headers
    )

    # 应安全处理, 返回空结果或正常响应 (不应抛出 500 错误)
    assert response.status_code == 200

    golden_assert(
        "search_notes_special_chars",
        response.json(),
        exclude_keys=["id", "created_at", "updated_at", "user_id"]
    )


# ========================================
# 学习总结
# ========================================

"""
黄金文件测试执行流程:

1. 重构前生成 baseline (保存重构前的 API 响应):
   $ pytest tests/golden/ --golden-update -v

   输出示例:
   ✅ 已更新 baseline: auth_login_success.json
   ✅ 已更新 baseline: notes_list_response.json
   ✅ 已更新 baseline: note_create_response.json
   ✅ 已更新 baseline: search_notes_normal.json

2. 执行重构 (修改代码):
   - 修复 SQL 注入漏洞
   - 优化数据库查询
   - 重构业务逻辑

3. 重构后验证 (对比 API 响应):
   $ pytest tests/golden/ -v

   成功示例:
   tests/golden/test_golden_notes.py::test_golden_notes_list PASSED
   tests/golden/test_golden_notes.py::test_golden_note_create PASSED
   tests/golden/test_golden_notes.py::test_golden_search_notes PASSED

   失败示例:
   tests/golden/test_golden_notes.py::test_golden_notes_list FAILED
   ❌ Golden Test 失败: notes_list_response
   差异详情:
   - values_changed: root['items'][0]['title']: 'Old Title' → 'New Title'

4. 处理差异:
   - 意外差异: 修复代码, 确保行为一致
   - 预期差异 (如性能优化): 批准差异
     $ pytest tests/golden/ --golden-approve

好处:
- 自动化重构验证, 无需手动测试
- 快速发现破坏性变更
- 提供历史对比基准
- 减少回归风险
"""
