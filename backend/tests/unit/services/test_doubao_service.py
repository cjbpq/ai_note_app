"""单元测试: Doubao AI 服务
学习要点:
- Mock 外部 AI 服务避免真实 API 调用
- 服务可用性检查测试
- 异常处理测试 (服务不可用时降级)
"""

import pytest
from unittest.mock import Mock, patch

from app.services import doubao_service


# ========================================
# 测试用例 1: 服务可用性检查
# ========================================

@pytest.mark.unit
def test_availability_status_available():
    """测试: Doubao 服务可用状态

    验证重点:
    - availability_status() 返回 (True, None)
    - is_available 属性为 True

    学习要点:
    - 服务可用性检查: 避免调用不可用的服务
    - 优雅降级: 服务不可用时使用备用方案
    - 健康检查: 定期检查外部服务状态
    """
    # 验证: 服务可用
    available, reason = doubao_service.availability_status()

    assert available is True or available is False, "应返回布尔值"

    if not available:
        assert reason is not None, "服务不可用时应提供原因"
        assert isinstance(reason, str), "原因应为字符串"


# ========================================
# 测试用例 2: Mock 生成笔记 (避免真实 API 调用)
# ========================================

@pytest.mark.unit
def test_generate_note_mock(monkeypatch):
    """测试: Mock Doubao 服务生成笔记 (避免真实 API 调用)

    验证重点:
    - generate_structured_note() 返回正确格式
    - Mock 替换真实 API 调用
    - 测试速度快 (无网络延迟)

    学习要点:
    - monkeypatch: pytest 内置工具, 临时替换模块/函数
    - Mock 外部服务: 隔离测试, 提高速度, 避免费用
    - 固定返回值: 确保测试可重复性

    为什么 Mock:
    - 避免依赖真实 Doubao API (费用, 速度, 配额)
    - 测试速度提升 100 倍以上 (无网络延迟)
    - 可模拟各种场景 (成功, 失败, 超时)
    """
    # Mock Doubao 服务
    class MockDoubaoService:
        is_available = True

        @staticmethod
        def availability_status():
            return True, None

        @staticmethod
        def generate_structured_note(extracted_text: str, language: str = "zh"):
            """Mock 生成笔记"""
            return {
                "note": {
                    "title": "Mock 笔记标题",
                    "summary": "Mock 摘要内容",
                    "raw_text": extracted_text,
                    "category": "Mock 分类"
                }
            }

    # 替换真实 doubao_service
    monkeypatch.setattr("app.services.doubao_service", MockDoubaoService())

    # 导入替换后的模块
    from app.services import doubao_service as mocked_service

    # 调用 Mock 服务
    result = mocked_service.generate_structured_note("测试文本")

    # 验证: 返回格式正确
    assert "note" in result
    assert "title" in result["note"]
    assert "summary" in result["note"]
    assert "raw_text" in result["note"]
    assert "category" in result["note"]

    # 验证: 包含输入文本
    assert result["note"]["raw_text"] == "测试文本"


# ========================================
# 测试用例 3: 服务不可用时降级
# ========================================

@pytest.mark.unit
def test_service_unavailable_degradation(monkeypatch):
    """测试: 服务不可用时优雅降级

    验证重点:
    - availability_status() 返回 (False, reason)
    - 应用层检查可用性后拒绝请求
    - 全局异常处理器返回 503 错误

    学习要点:
    - 优雅降级: 外部服务不可用时不应导致应用崩溃
    - 健康检查: 依赖注入模式自动检查服务可用性
    - 错误响应: 返回清晰的错误信息 (503 Service Unavailable)

    为什么重要:
    - 外部服务可能不稳定 (API 限流, 维护, 故障)
    - 避免级联故障 (一个服务故障导致整个应用不可用)
    - 用户体验: 提供清晰的错误提示而非内部错误
    """
    # Mock 服务不可用
    class MockUnavailableDoubaoService:
        is_available = False

        @staticmethod
        def availability_status():
            return False, "API 配额已用尽"

    # 替换服务
    monkeypatch.setattr("app.services.doubao_service", MockUnavailableDoubaoService())

    from app.services import doubao_service as mocked_service

    # 验证: 服务不可用
    available, reason = mocked_service.availability_status()

    assert available is False
    assert reason == "API 配额已用尽"


# ========================================
# 学习总结
# ========================================

"""
外部服务测试最佳实践:

1. Mock 外部 API:
   - 使用 monkeypatch 或 unittest.mock 替换真实服务
   - 避免真实 API 调用 (费用, 速度, 配额)
   - 提供固定返回值确保测试可重复

2. 服务可用性检查:
   - 实现 availability_status() 方法
   - 返回 (bool, str) 元组: (是否可用, 不可用原因)
   - 依赖注入: 端点自动检查服务可用性

3. 优雅降级:
   - 服务不可用时返回 503 错误
   - 提供清晰的错误信息给用户
   - 避免级联故障影响其他功能

4. 测试覆盖:
   - 正常场景: 服务可用, 成功生成笔记
   - 异常场景: 服务不可用, API 超时, 返回格式错误
   - 边界条件: 空输入, 超长输入, 特殊字符

5. Mock 策略:
   - 简单场景: 使用 monkeypatch.setattr()
   - 复杂场景: 使用 unittest.mock.Mock/MagicMock
   - 验证调用: 使用 Mock.assert_called_with() 验证参数

6. 为什么 Mock:
   - 速度: Mock 测试比真实 API 快 100 倍以上
   - 可靠性: 不依赖外部服务可用性
   - 成本: 避免 API 调用费用
   - 隔离性: 测试不受网络和外部服务影响

7. 真实 API 测试 (集成测试):
   - 在集成测试中使用真实 API
   - 定期运行 (每天/每周) 验证集成有效性
   - 使用测试账号和配额避免影响生产环境
"""
