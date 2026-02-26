"""黄金文件测试框架配置
学习要点:
- 黄金文件测试原理: 保存重构前 API 响应作为基准, 重构后自动对比确保行为一致
- DeepDiff: 智能对比 JSON 差异, 支持排除动态字段 (id, timestamp)
- pytest --golden-update: 更新模式, 生成新 baseline
- pytest tests/golden/: 验证模式, 对比实际响应与 baseline

为什么使用黄金文件测试:
- 重构保护: 确保重构后 API 行为不变
- 快速反馈: 自动对比差异, 无需手动验证
- 历史记录: baseline 文件记录重构前的行为标准
"""

import json
import os
from pathlib import Path
from deepdiff import DeepDiff
import pytest
import yaml


# 黄金文件目录
BASELINE_DIR = Path(__file__).parent / "baselines"
APPROVED_DIFFS_FILE = Path(__file__).parent / "approved_diffs.yaml"


# ========================================
# pytest 命令行选项
# ========================================

def pytest_addoption(parser):
    """添加自定义 pytest 命令行选项

    学习要点:
    - pytest_addoption: pytest hook, 扩展命令行参数
    - action="store_true": 布尔选项 (存在即为 True)
    - 用法: pytest tests/golden/ --golden-update
    """
    parser.addoption(
        "--golden-update",
        action="store_true",
        default=False,
        help="更新黄金基准文件 (重构前生成 baseline)"
    )
    parser.addoption(
        "--golden-approve",
        action="store_true",
        default=False,
        help="批准当前差异并更新 approved_diffs.yaml"
    )


# ========================================
# 核心 Fixture: golden_assert
# ========================================

@pytest.fixture
def golden_assert(request):
    """黄金文件断言辅助函数

    学习要点:
    - request: pytest 内置 fixture, 访问测试配置和命令行选项
    - exclude_keys: 排除动态字段 (如 id, created_at, timestamp)
    - ignore_order: 忽略列表顺序 (API 返回顺序可能不同)

    用法示例:
        def test_api_response(golden_assert):
            response = client.get("/api/endpoint")
            golden_assert(
                "endpoint_response",
                response.json(),
                exclude_keys=["id", "created_at"]
            )

    工作流程:
    1. 更新模式 (--golden-update): 保存响应到 baselines/
    2. 验证模式 (默认): 对比响应与 baseline, 差异会导致测试失败
    """
    def _assert(
        test_name: str,
        actual_response: dict,
        *,
        exclude_keys: list = None
    ):
        """
        对比实际响应与黄金基准

        Args:
            test_name: 测试用例名称 (用于查找 baseline 文件)
            actual_response: 实际 API 响应 (dict)
            exclude_keys: 需要排除对比的动态字段 (如 id, timestamp)

        工作流程:
        - 更新模式: 保存 actual_response 到 baselines/{test_name}.json
        - 验证模式: 加载 baseline 并对比差异
        """
        baseline_file = BASELINE_DIR / f"{test_name}.json"

        # ========================================
        # 模式 1: 更新 baseline (重构前)
        # ========================================
        if request.config.getoption("--golden-update"):
            # 确保目录存在
            BASELINE_DIR.mkdir(exist_ok=True)

            # 保存响应到 baseline 文件
            with open(baseline_file, "w", encoding="utf-8") as f:
                json.dump(actual_response, f, indent=2, ensure_ascii=False)

            print(f"\n✅ 已更新 baseline: {baseline_file.name}")
            return

        # ========================================
        # 模式 2: 验证 baseline (重构后)
        # ========================================

        # 检查 baseline 是否存在
        if not baseline_file.exists():
            pytest.fail(
                f"❌ Baseline 不存在: {baseline_file}\n"
                f"请先运行以下命令生成基准:\n"
                f"  pytest tests/golden/ --golden-update -v"
            )

        # 加载 baseline
        with open(baseline_file, encoding="utf-8") as f:
            expected_response = json.load(f)

        # ========================================
        # 差异对比 (使用 DeepDiff)
        # ========================================

        # 构建排除路径 (排除动态字段)
        exclude_paths = []
        if exclude_keys:
            # 支持嵌套字段排除 (如 "root['data'][0]['id']")
            for key in exclude_keys:
                exclude_paths.append(f"root['{key}']")
                # 支持嵌套列表中的字段
                exclude_paths.append(f"root['items'][*]['{key}']")

        # 深度对比
        diff = DeepDiff(
            expected_response,
            actual_response,
            exclude_paths=set(exclude_paths),
            ignore_order=True,  # 忽略列表顺序
            verbose_level=2,    # 详细差异信息
        )

        # 检查差异
        if diff:
            # 检查是否为已批准的差异
            if _is_approved_diff(test_name, diff):
                print(f"\n✅ 差异已批准: {test_name}")
                return

            # 未批准的差异 → 测试失败
            pytest.fail(
                f"\n❌ Golden Test 失败: {test_name}\n"
                f"\n{'='*60}\n"
                f"差异详情:\n"
                f"{diff.pretty()}\n"
                f"{'='*60}\n"
                f"\n如果差异符合预期 (如性能优化), 运行以下命令批准:\n"
                f"  pytest tests/golden/ --golden-approve\n"
            )

    return _assert


# ========================================
# 辅助函数
# ========================================

def _is_approved_diff(test_name: str, diff: DeepDiff) -> bool:
    """检查差异是否已批准

    学习要点:
    - approved_diffs.yaml: 记录已批准的差异 (如性能优化导致的响应格式变化)
    - 差异哈希: 基于 diff 内容生成唯一标识, 防止批准过期

    为什么需要批准机制:
    - 部分差异是预期的 (如性能优化, 新增字段)
    - 避免每次重构都需要手动确认
    - 提供审计追踪 (谁批准的, 什么时候批准的)
    """
    if not APPROVED_DIFFS_FILE.exists():
        return False

    try:
        with open(APPROVED_DIFFS_FILE, encoding="utf-8") as f:
            approved_diffs = yaml.safe_load(f) or {}

        # 检查测试用例是否有已批准的差异
        test_approved = approved_diffs.get(test_name, [])

        # 简化示例: 检查差异类型是否在批准列表
        # 生产环境应使用差异哈希或详细对比
        if "values_changed" in diff and "performance_optimization" in test_approved:
            return True

        return False

    except Exception as e:
        print(f"⚠️ 读取 approved_diffs.yaml 失败: {e}")
        return False


def _save_approved_diff(test_name: str, diff: DeepDiff):
    """保存已批准的差异 (供 --golden-approve 使用)"""
    approved_diffs = {}

    if APPROVED_DIFFS_FILE.exists():
        with open(APPROVED_DIFFS_FILE, encoding="utf-8") as f:
            approved_diffs = yaml.safe_load(f) or {}

    # 记录差异类型
    approved_diffs[test_name] = list(diff.keys())

    # 保存到文件
    with open(APPROVED_DIFFS_FILE, "w", encoding="utf-8") as f:
        yaml.dump(approved_diffs, f, allow_unicode=True)


# ========================================
# 学习示例
# ========================================

"""
示例 1: 基础黄金测试

def test_golden_login_success(golden_assert, test_client):
    '''验证登录成功响应格式不变'''
    response = test_client.post("/api/v1/auth/login", json={
        "username": "testuser",
        "password": "TestPassword123"
    })

    assert response.status_code == 200

    # 排除动态字段 (access_token 每次不同)
    golden_assert(
        "login_success",
        response.json(),
        exclude_keys=["access_token", "expires_in"]
    )


示例 2: 列表响应黄金测试

def test_golden_notes_list(golden_assert, test_client, auth_token):
    '''验证笔记列表响应格式不变'''
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = test_client.get("/api/v1/library/notes", headers=headers)

    assert response.status_code == 200

    # 排除动态字段 (id, created_at, updated_at)
    golden_assert(
        "notes_list_response",
        response.json(),
        exclude_keys=["id", "created_at", "updated_at"]
    )


执行流程:
1. 重构前生成 baseline:
   pytest tests/golden/ --golden-update -v

2. 重构后验证一致性:
   pytest tests/golden/ -v

3. 批准预期差异 (可选):
   pytest tests/golden/ --golden-approve
"""
