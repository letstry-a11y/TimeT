from datetime import datetime, timezone, timedelta

BEIJING_TZ = timezone(timedelta(hours=8))


def now_beijing() -> datetime:
    """返回当前北京时间（naive，无时区信息）"""
    return datetime.now(BEIJING_TZ).replace(tzinfo=None)


def to_naive_beijing(dt: datetime | None) -> datetime | None:
    """将任意 datetime 转换为 naive 北京时间"""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(BEIJING_TZ).replace(tzinfo=None)
    # 假设无时区信息的 datetime 已经是北京时间
    return dt
