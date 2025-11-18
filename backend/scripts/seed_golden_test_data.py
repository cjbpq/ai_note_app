"""黄金文件测试数据种子脚本
学习要点:
- 生成固定测试数据确保黄金测试可重复
- 使用固定 ID 和内容避免随机性
- 在生成 baseline 前执行此脚本

为什么需要种子数据:
- 黄金测试依赖固定数据生成一致的 API 响应
- 避免每次测试数据不同导致 baseline 变化
- 简化重构验证流程
"""

import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.user import User
from app.models.note import Note
from app.core.security import get_password_hash
from datetime import datetime, timezone


def seed_golden_test_data():
    """生成黄金测试固定数据

    步骤:
    1. 创建测试数据库 (SQLite)
    2. 创建固定测试用户: testuser
    3. 创建 5 条固定笔记
    4. 提交到数据库

    学习要点:
    - 使用固定 ID: 确保每次运行结果相同
    - 使用固定时间: 避免 created_at 字段变化
    - 使用固定内容: 笔记标题和内容固定
    """
    # 连接数据库 (使用项目配置的数据库)
    # 注意: 生产环境不应运行此脚本!
    from app.core.config import settings

    engine = create_engine(settings.DATABASE_URL, echo=True)

    # 创建所有表
    Base.metadata.create_all(bind=engine)

    # 创建会话
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        # ========================================
        # 1. 创建固定测试用户
        # ========================================
        print("\n=== 创建测试用户 ===")

        # 检查用户是否已存在
        existing_user = db.query(User).filter(User.username == "testuser").first()
        if existing_user:
            print("⚠️ 测试用户已存在, 跳过创建")
            user = existing_user
        else:
            user = User(
                id="test-user-123",  # 固定 ID
                username="testuser",
                email="test@example.com",
                password_hash=get_password_hash("TestPassword123")  # 修正: 字段名是 password_hash
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"✅ 创建测试用户: {user.username}")

        # ========================================
        # 2. 创建固定测试笔记
        # ========================================
        print("\n=== 创建测试笔记 ===")

        # 固定时间 (避免 created_at 变化)
        fixed_time = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

        # 固定笔记数据
        test_notes = [
            {
                "id": "note-001",
                "title": "Python 学习笔记",
                "original_text": "学习 Python 基础语法和面向对象编程",
                "category": "学习笔记"
            },
            {
                "id": "note-002",
                "title": "FastAPI 入门教程",
                "original_text": "FastAPI 是一个现代化的 Python Web 框架",
                "category": "技术文档"
            },
            {
                "id": "note-003",
                "title": "测试驱动开发实践",
                "original_text": "TDD 核心理念: 先写测试, 再写代码",
                "category": "开发笔记"
            },
            {
                "id": "note-004",
                "title": "SQL 注入防护方法",
                "original_text": "使用 ORM 参数化查询防止 SQL 注入攻击",
                "category": "安全笔记"
            },
            {
                "id": "note-005",
                "title": "黄金文件测试指南",
                "original_text": "黄金测试验证重构后 API 行为不变",
                "category": "测试笔记"
            },
        ]

        for note_data in test_notes:
            # 检查笔记是否已存在
            existing_note = db.query(Note).filter(Note.id == note_data["id"]).first()
            if existing_note:
                print(f"⚠️ 笔记已存在: {note_data['title']}")
                continue

            # 创建笔记
            note = Note(
                id=note_data["id"],
                user_id=user.id,
                device_id="test-device-001",  # 固定测试设备 ID
                title=note_data["title"],
                original_text=note_data["original_text"],
                category=note_data["category"],
                tags=[],  # 空标签列表
                image_url=f"https://example.com/test-images/{note_data['id']}.jpg",  # 测试图片 URL
                image_filename=f"{note_data['id']}.jpg",  # 测试图片文件名
                image_size=1024000,  # 1MB 测试文件大小
                structured_data={},  # 空结构化数据
                is_favorite=False,
                is_archived=False,
                created_at=fixed_time,
                updated_at=fixed_time
            )
            db.add(note)
            print(f"✅ 创建笔记: {note.title}")

        db.commit()

        # ========================================
        # 3. 验证数据
        # ========================================
        print("\n=== 数据验证 ===")
        total_notes = db.query(Note).filter(Note.user_id == user.id).count()
        print(f"用户 {user.username} 共有 {total_notes} 条笔记")

        print("\n✅ 种子数据生成完成!")
        print("\n下一步: 运行以下命令生成黄金 baseline")
        print("  pytest tests/golden/ --golden-update -v")

    except Exception as e:
        db.rollback()
        print(f"\n❌ 错误: {e}")
        raise

    finally:
        db.close()


if __name__ == "__main__":
    print("=== 黄金测试数据种子脚本 ===")
    print("⚠️ 注意: 此脚本会修改数据库, 仅在测试环境运行!\n")

    # 确认执行
    confirm = input("确认执行? (yes/no): ")
    if confirm.lower() != "yes":
        print("❌ 已取消")
        sys.exit(0)

    seed_golden_test_data()
