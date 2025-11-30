"""
统一日志记录系统配置

学习要点:
- 使用 Python 标准库 logging 模块
- 配置日志格式、级别和输出 handlers
- 生产环境可使用 JSON 格式便于日志分析工具解析

为什么这么改:
1. 统一配置: 所有模块使用相同的日志格式和级别
2. 结构化日志: 便于 ELK/Splunk 等工具解析和分析
3. 分级记录: DEBUG (开发调试), INFO (关键操作), WARNING (可恢复错误), ERROR (需人工介入)
"""

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

from app.core.config import settings


def setup_logging() -> None:
    """配置应用日志系统

    学习要点:
    - logging.basicConfig 配置根日志器
    - StreamHandler 输出到控制台
    - RotatingFileHandler 输出到文件并自���轮转（防止文件过大）
    - 第三方库日志级别: 设置为 WARNING 避免过多日志

    日志文件配置:
    - 文件路径: logs/app.log
    - 单文件最大: 10MB
    - 保留文件数: 5 个（总共最多 50MB）
    - 自动轮转: 超过 10MB 自动创建新文件
    """
    # 根日志器配置
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO

    # 日志格式: 时间 - 模块名 - 级别 - 消息
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    # 确保日志目录存在
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)

    # 配置日志处理器
    handlers = [
        logging.StreamHandler(sys.stdout),  # 输出到控制台
        RotatingFileHandler(
            filename=log_dir / "app.log",
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,  # 保留 5 个备份文件
            encoding="utf-8",
        ),
    ]

    # 基础配置
    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=handlers,
    )

    # 设置第三方库日志级别 (避免过多日志)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    logger = logging.getLogger(__name__)
    logger.info("日志系统已初始化")
