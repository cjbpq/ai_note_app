"""日期时间格式化工具：统一将 datetime 转换为本地时区并格式化为可读字符串。"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Optional
from zoneinfo import ZoneInfo

from pydantic import PlainSerializer

from app.core.config import settings

_LOCAL_TZ = ZoneInfo(settings.TIMEZONE)


def format_local(dt: Optional[datetime]) -> Optional[str]:
    """将 datetime 转换为本地时区并格式化为 'YYYY-MM-DD HH:MM:SS'。

    - 带时区信息的 datetime → 转换到 settings.TIMEZONE
    - naive datetime（无时区）→ 视为 UTC 后转换
    - None → 返回 None
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    return dt.astimezone(_LOCAL_TZ).strftime("%Y-%m-%d %H:%M:%S")


# Pydantic v2 可复用类型：在 schema 中用 LocalDatetime 替代 datetime 即可自动格式化
LocalDatetime = Annotated[datetime, PlainSerializer(format_local, return_type=Optional[str])]
