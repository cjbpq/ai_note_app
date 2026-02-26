"""安全测试: 密码安全
学习要点:
- bcrypt 哈希强度验证
- 密码哈希唯一性 (加盐)
- 弱密码检测 (可选, 生产环境建议实现)
"""

import pytest
from app.core.security import get_password_hash, verify_password


# ========================================
# 测试用例 1: bcrypt 哈希强度
# ========================================

@pytest.mark.security
def test_bcrypt_hash_algorithm():
    """测试: 使用 bcrypt 算法哈希密码

    验证重点:
    - 哈希结果以 $2b$ 开头 (bcrypt 算法标识)
    - 哈希长度为 60 字符
    - 包含 salt (自动加盐)

    学习要点:
    - bcrypt: 自动加盐的密码哈希算法
    - $2b$12$: bcrypt 前缀, 12 表示 cost factor (迭代次数 2^12)
    - 不使用弱算法: MD5, SHA1, SHA256 (无盐哈希易被彩虹表攻击)

    为什么使用 bcrypt:
    - 自动加盐: 防止彩虹表攻击
    - 高计算成本: 防止暴力破解 (每次哈希约 0.1-0.3s)
    - 业界标准: 广泛使用, 经过时间验证
    """
    password = "TestPassword123"
    hashed = get_password_hash(password)

    # 验证: bcrypt 算法标识 ($2b$)
    assert hashed.startswith("$2b$"), \
        f"应使用 bcrypt 算法, 实际: {hashed[:4]}"

    # 验证: 哈希长度 (bcrypt 固定 60 字符)
    assert len(hashed) == 60, \
        f"bcrypt 哈希长度应为 60, 实际: {len(hashed)}"

    # 验证: 哈希不包含原始密码
    assert password not in hashed, \
        "哈希不应包含原始密码 (不可逆性)"


# ========================================
# 测试用例 2: 密码哈希唯一性 (加盐)
# ========================================

@pytest.mark.security
def test_password_hash_uniqueness_with_salt():
    """测试: 相同密码生成不同哈希 (加盐机制)

    验证重点:
    - 相同密码多次哈希结果不同
    - 每次自动生成随机 salt
    - 验证功能正常工作 (能够验证所有哈希)

    学习要点:
    - salt (盐): 随机字符串, 与密码混合后哈希
    - 防止彩虹表攻击: 相同密码不同用户哈希不同
    - bcrypt 自动管理 salt: 无需手动生成和存储

    为什么重要:
    - 防止批量破解: 攻击者无法使用预计算哈希表
    - 用户隐私: 即使密码相同, 哈希也不同, 攻击者无法识别
    - 数据库泄露保护: 攻击者需要逐个破解密码
    """
    password = "TestPassword123"

    # 生成多个哈希
    hash1 = get_password_hash(password)
    hash2 = get_password_hash(password)
    hash3 = get_password_hash(password)

    # 验证: 哈希结果不同 (加盐机制)
    assert hash1 != hash2, "相同密码应生成不同哈希 (salt1 != salt2)"
    assert hash2 != hash3, "相同密码应生成不同哈希 (salt2 != salt3)"
    assert hash1 != hash3, "相同密码应生成不同哈希 (salt1 != salt3)"

    # 验证: 所有哈希都能验证原始密码
    assert verify_password(password, hash1) is True
    assert verify_password(password, hash2) is True
    assert verify_password(password, hash3) is True


# ========================================
# 测试用例 3: 密码验证安全性
# ========================================

@pytest.mark.security
def test_password_verification_security():
    """测试: 密码验证功能安全性

    验证重点:
    - 正确密码验证通过
    - 错误密码验证失败
    - 空密码验证失败
    - 大小写敏感 (TestPassword123 != testpassword123)

    学习要点:
    - 时间攻击防护: bcrypt.checkpw() 验证时间恒定
    - 错误处理: 验证失败返回 False, 不抛出异常
    - 大小写敏感: 密码应区分大小写

    为什么重要:
    - 防止暴力破解: 错误密码应被拒绝
    - 时间攻击防护: 验证时间不泄露密码长度信息
    - 用户体验: 清晰的验证结果 (True/False)
    """
    password = "TestPassword123"
    hashed = get_password_hash(password)

    # 验证 1: 正确密码通过
    assert verify_password(password, hashed) is True

    # 验证 2: 错误密码失败
    assert verify_password("WrongPassword", hashed) is False

    # 验证 3: 空密码失败
    assert verify_password("", hashed) is False

    # 验证 4: 大小写敏感
    assert verify_password("testpassword123", hashed) is False
    assert verify_password("TESTPASSWORD123", hashed) is False


# ========================================
# 测试用例 4: 性能验证 (bcrypt cost factor)
# ========================================

@pytest.mark.security
@pytest.mark.slow
def test_bcrypt_performance():
    """测试: bcrypt 哈希性能 (计算成本)

    验证重点:
    - 哈希时间在合理范围内 (0.05s - 0.5s)
    - cost factor 平衡安全性和性能
    - 防止暴力破解 (每次验证需要时间)

    学习要点:
    - cost factor: bcrypt 迭代次数 2^cost
    - cost=12: 约 0.1-0.3s (推荐值, 平衡安全和性能)
    - cost=10: 约 0.03-0.1s (稍快, 安全性稍低)
    - cost=14: 约 0.5-1.5s (更安全, 性能较差)

    为什么重要:
    - 防止暴力破解: 每次哈希耗时, 攻击者无法快速尝试
    - 用户体验: 登录验证不应过慢 (< 0.5s 可接受)
    - 未来扩展性: cost factor 可随硬件升级逐步提高
    """
    import time

    password = "TestPassword123"

    # 测量哈希时间
    start = time.time()
    hashed = get_password_hash(password)
    hash_time = time.time() - start

    # 验证: 哈希时间在合理范围内 (0.05s - 0.5s)
    assert 0.05 <= hash_time <= 0.5, \
        f"bcrypt 哈希时间应在 0.05-0.5s, 实际: {hash_time:.3f}s"

    # 测量验证时间
    start = time.time()
    verify_password(password, hashed)
    verify_time = time.time() - start

    # 验证: 验证时间在合理范围内 (0.05s - 0.5s)
    assert 0.05 <= verify_time <= 0.5, \
        f"bcrypt 验证时间应在 0.05-0.5s, 实际: {verify_time:.3f}s"


# ========================================
# 学习总结
# ========================================

"""
密码安全最佳实践:

1. 哈希算法选择:
   ✅ 推荐: bcrypt, scrypt, Argon2 (自动加盐, 高计算成本)
   ❌ 禁止: MD5, SHA1, SHA256 (无盐哈希, 易被彩虹表攻击)

2. bcrypt 参数:
   - cost factor (迭代次数):
     * 10: 快速, 适合开发环境 (约 0.03-0.1s)
     * 12: 平衡, 推荐生产环境 (约 0.1-0.3s)
     * 14: 安全, 高安全需求场景 (约 0.5-1.5s)

3. 密码存储规则:
   - 永远不要存储明文密码
   - 哈希结果存储到数据库 (60 字符)
   - 每个用户独立加盐 (bcrypt 自动处理)
   - 定期升级 cost factor (随硬件升级)

4. 密码验证流程:
   1. 用户输入密码
   2. 从数据库加载哈希
   3. bcrypt.checkpw(输入密码, 哈希)
   4. 返回 True/False

5. 安全威胁:
   - 彩虹表攻击: 预计算常见密码哈希 (加盐防御)
   - 暴力破解: 逐个尝试密码 (高计算成本防御)
   - 时间攻击: 通过验证时间推测密码长度 (恒定时间验证)
   - 数据库泄露: 哈希被盗后离线破解 (高 cost factor 防御)

6. 密码策略 (生产环境建议):
   - 最小长度: 8 字符
   - 复杂度要求: 大小写+数字+特殊字符
   - 密码历史: 不允许重复使用最近 5 个密码
   - 定期更新: 每 90 天强制修改密码
   - 失败锁定: 5 次失败后锁定账号 15 分钟

7. 常见错误:
   ❌ 存储明文密码
   ❌ 使用弱哈希算法 (MD5, SHA1)
   ❌ 不加盐哈希
   ❌ cost factor 过低 (< 10)
   ❌ 密码在日志中明文记录
   ❌ 密码通过 URL 参数传递
"""
