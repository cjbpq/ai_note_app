"""测试数据工厂 (使用 factory_boy)
学习要点:
- factory_boy: 简化测试数据生成, 避免重复创建对象代码
- Faker: 自动生成随机但合理的测试数据 (姓名, 邮箱, UUID)
- Sequence: 生成递增序列 (user1, user2, user3)
- LazyAttribute: 动态计算字段值 (基于其他字段)

为什么使用 factory_boy:
- 减少测试代码重复: 定义 1 次工厂, 所有测试复用
- 灵活性: 可覆盖默认值创建特定场景数据
- 可读性: UserFactory.create() 比手动创建更清晰
"""

import factory
from faker import Faker
from datetime import datetime, timezone

from app.models.user import User
from app.models.note import Note

fake = Faker("zh_CN")  # 中文 Faker


# ========================================
# 用户工厂
# ========================================

class UserFactory(factory.Factory):
    """用户数据工厂

    用法示例:
        # 创建用户 (不保存到数据库)
        user = UserFactory.build(username="custom_user")

        # 创建并保存到数据库 (需要配置 SQLAlchemy session)
        user = UserFactory.create()
    """

    class Meta:
        model = User

    # 使用 Faker 生成 UUID
    id = factory.LazyFunction(lambda: fake.uuid4())

    # 生成递增用户名: user1, user2, user3...
    username = factory.Sequence(lambda n: f"user{n}")

    # 根据 username 生成邮箱: user1@example.com
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@example.com")

    # 生成哈希密码 (默认密码: TestPassword123)
    hashed_password = factory.LazyFunction(
        lambda: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU2DJO3CqPCa"
    )


# ========================================
# 笔记工厂
# ========================================

class NoteFactory(factory.Factory):
    """笔记数据工厂

    用法示例:
        # 创建笔记 (需要指定 user_id)
        note = NoteFactory.build(user_id="test-user-123")

        # 批量创建笔记
        notes = NoteFactory.build_batch(10, user_id="test-user-123")
    """

    class Meta:
        model = Note

    # UUID 主键
    id = factory.LazyFunction(lambda: fake.uuid4())

    # 必须由测试指定 (无默认值)
    user_id = factory.LazyFunction(lambda: fake.uuid4())

    # 随机笔记标题 (5 个词的句子)
    title = factory.LazyFunction(lambda: fake.sentence(nb_words=5))

    # 随机原始文本 (3 句话的段落)
    original_text = factory.LazyFunction(lambda: fake.paragraph(nb_sentences=3))

    # 随机分类
    category = factory.LazyFunction(
        lambda: fake.random_element(elements=["学习笔记", "工作笔记", "生活记录", "项目文档"])
    )

    # 固定字段
    is_archived = False
    created_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))
    updated_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))


# ========================================
# 学习示例
# ========================================

"""
示例 1: 创建单个测试对象

def test_create_note(db_session):
    user = UserFactory.build(username="alice")
    db_session.add(user)
    db_session.commit()

    note = NoteFactory.build(user_id=user.id, title="我的第一篇笔记")
    db_session.add(note)
    db_session.commit()

    assert note.title == "我的第一篇笔记"


示例 2: 批量创建测试数据

def test_search_performance(db_session):
    user = UserFactory.build()
    db_session.add(user)
    db_session.commit()

    # 创建 1000 条笔记
    notes = NoteFactory.build_batch(1000, user_id=user.id)
    db_session.add_all(notes)
    db_session.commit()

    # 性能测试
    start = time.time()
    results = search_notes(user.id, "笔记")
    elapsed = time.time() - start

    assert elapsed < 0.2  # 搜索应在 200ms 内完成


示例 3: 覆盖默认值

def test_archived_note(db_session):
    note = NoteFactory.build(
        is_archived=True,  # 覆盖默认值 False
        category="已归档"
    )
    db_session.add(note)
    db_session.commit()

    assert note.is_archived == True
"""
