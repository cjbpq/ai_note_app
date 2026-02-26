"""Pydantic v2 迁移测试

测试 .dict() → .model_dump() 迁移的兼容性和功能一致性

学习要点:
- Pydantic v2 的 model_dump() 方法完全替代 v1 的 dict() 方法
- exclude_unset=True 确保只序列化用户明确设置的字段 (避免覆盖数据库未修改字段)
- Pydantic v2 使用 Rust 实现核心验证逻辑, 性能提升 5-10 倍
"""

import pytest
from pydantic import BaseModel, Field
from typing import Optional


class NoteUpdate(BaseModel):
    """模拟笔记更新模型"""
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[list[str]] = None


def test_model_dump_excludes_unset_fields():
    """测试 model_dump(exclude_unset=True) 行为

    学习要点:
    - exclude_unset=True 只包含用户明确提供的字段
    - 未设置的字段不会出现在输出字典中
    - 这对于 PATCH 请求非常重要 (部分更新场景)
    """
    # 仅更新标题
    note_update = NoteUpdate(title="新标题")

    # 使用 model_dump(exclude_unset=True)
    update_data = note_update.model_dump(exclude_unset=True)

    # 验证: 只包含 title, 不包含 content/category/tags
    assert "title" in update_data
    assert update_data["title"] == "新标题"
    assert "content" not in update_data
    assert "category" not in update_data
    assert "tags" not in update_data

    print("✅ exclude_unset=True 行为验证通过: 只序列化用户设置的字段")


def test_model_dump_json_compatibility():
    """测试 model_dump() 的 JSON 序列化兼容性

    学习要点:
    - model_dump() 返回标准 Python 字典, 可以被 json.dumps() 序列化
    - 与 Pydantic v1 的 dict() 方法行为完全一致
    - 支持嵌套模型和复杂类型 (list, dict, datetime)
    """
    import json

    # 创建包含所有字段的笔记
    note_update = NoteUpdate(
        title="完整笔记",
        content="笔记内容",
        category="学习笔记",
        tags=["Python", "FastAPI", "Pydantic"]
    )

    # 使用 model_dump() 序列化
    note_dict = note_update.model_dump()

    # 验证: 可以被 JSON 序列化
    json_str = json.dumps(note_dict, ensure_ascii=False)
    assert isinstance(json_str, str)

    # 验证: 反序列化后数据一致
    deserialized = json.loads(json_str)
    assert deserialized["title"] == "完整笔记"
    assert deserialized["tags"] == ["Python", "FastAPI", "Pydantic"]

    print("✅ JSON 序列化兼容性验证通过")


def test_model_dump_with_exclude_none():
    """测试 model_dump(exclude_none=True) 过滤 None 值

    学习要点:
    - exclude_none=True 移除值为 None 的字段
    - exclude_unset=True 移除用户未设置的字段 (即使默认值是 None)
    - 两者可以组合使用: model_dump(exclude_unset=True, exclude_none=True)
    """
    # 显式设置 content=None
    note_update = NoteUpdate(title="标题", content=None)

    # 不过滤 None
    full_dump = note_update.model_dump(exclude_unset=True)
    assert "content" in full_dump
    assert full_dump["content"] is None

    # 过滤 None 值
    filtered_dump = note_update.model_dump(exclude_unset=True, exclude_none=True)
    assert "title" in filtered_dump
    assert "content" not in filtered_dump

    print("✅ exclude_none=True 行为验证通过")


if __name__ == "__main__":
    # 运行测试
    test_model_dump_excludes_unset_fields()
    test_model_dump_json_compatibility()
    test_model_dump_with_exclude_none()
    print("\n🎉 所有 Pydantic v2 迁移测试通过!")
