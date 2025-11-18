"""测试 SECRET_KEY 硬编码修复

验证 SECRET_KEY 必须从环境变量加载, 不允许硬编码默认值
"""
import os
import pytest
from pydantic import ValidationError


def test_secret_key_not_hardcoded():
    """验证 SECRET_KEY 无硬编码默认值

    改前风险: SECRET_KEY = "your-secret-key-change-in-production" (硬编码)
    改后行为: SECRET_KEY = Field(...) (必填, 未配置环境变量会报错)
    """
    # 清空环境变量中的 SECRET_KEY
    old_secret = os.environ.pop("SECRET_KEY", None)

    try:
        # 尝试导入 settings (应该失败, 因为 SECRET_KEY 未配置)
        from importlib import reload
        from app.core import config

        # 重��加载配置模块
        with pytest.raises(ValidationError) as exc_info:
            reload(config)

        # 验证错误信息包含 SECRET_KEY 字段
        assert "SECRET_KEY" in str(exc_info.value)

    finally:
        # 恢复环境变量
        if old_secret:
            os.environ["SECRET_KEY"] = old_secret


def test_secret_key_min_length():
    """验证 SECRET_KEY 最小长度限制

    安全要求: 密钥长度至少 32 字节
    """
    # 设置过短的密钥 (少于 32 字节)
    os.environ["SECRET_KEY"] = "too-short-key"

    try:
        from importlib import reload
        from app.core import config

        with pytest.raises(ValidationError) as exc_info:
            reload(config)

        # 验证错误信息包含长度限制
        error_msg = str(exc_info.value)
        assert "at least 32 characters" in error_msg or "min_length" in error_msg

    finally:
        # 恢复长密钥
        os.environ["SECRET_KEY"] = "test-secret-key-with-sufficient-length-32-bytes-min"


def test_secret_key_from_env():
    """验证 SECRET_KEY 可以从环境变量正确加载

    预期行为: 配置有效密钥后, 应用可以正常启动
    """
    # 设置有效的密钥 (至少 32 字节)
    test_secret = "test-secret-key-with-sufficient-length-32-bytes-minimum"
    os.environ["SECRET_KEY"] = test_secret

    try:
        from importlib import reload
        from app.core import config

        # 重新加载配置
        reload(config)

        # 验证密钥已正确加载
        assert config.settings.SECRET_KEY == test_secret
        assert len(config.settings.SECRET_KEY) >= 32

    finally:
        pass  # 保留测试密钥供其他测试使用
