"""
自定义异常类和全局异常处理

学习要点:
- 自定义异常类继承自 Exception, 提供业务语义
- 区分业务异常 (ServiceError) 和系统异常 (Exception)
- 统一错误响应格式, 便于前端处理

为什么这么改:
1. 语义清晰: DoubaoServiceUnavailable 比 HTTPException(500, "服务不可用") 更明确
2. 统一处理: 全局异常处理器捕获 ServiceError, 返回标准格式
3. 便于监控: 自定义异常可分类统计, 如 Doubao 调用失败次数
"""

from datetime import datetime, timezone
from typing import Optional


class ServiceError(Exception):
    """业务逻辑异常基类

    学习要点:
    - 业务异常继承自 ServiceError, 便于全局处理器统一捕获
    - status_code 属性用于返回 HTTP 状态码
    - detail 属性包含错误详情, 前端可直接展示给用户
    """

    def __init__(self, detail: str, status_code: int = 500):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class DoubaoServiceUnavailable(ServiceError):
    """Doubao 服务不可用异常

    使用场景:
    - Doubao SDK 未安装
    - API Key 或 AK/SK 未配置
    - Doubao API 调用超时或失败
    """

    def __init__(self, reason: Optional[str] = None):
        detail = "Doubao 服务未配置或密钥缺失"
        if reason:
            detail = f"Doubao 服务未配置: {reason}"
        super().__init__(detail, status_code=503)


class NoteNotFoundError(ServiceError):
    """笔记不存在异常

    使用场景:
    - 用户查询不存在的笔记 ID
    - 用户尝试修改/删除不属于自己的笔记
    """

    def __init__(self, note_id: str):
        super().__init__(f"笔记不存在: {note_id}", status_code=404)


class DatabaseError(ServiceError):
    """数据库操作异常

    使用场景:
    - 数据库连接失败
    - SQL 执行错误
    - 事务提交失败
    """

    def __init__(self, detail: str):
        super().__init__(f"数据库错误: {detail}", status_code=500)
