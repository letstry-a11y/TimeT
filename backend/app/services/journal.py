"""Beijing calendar windows and actual coverage shared by the journal and reviews."""
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from math import ceil, floor
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal
from app.models.journal import DailyActivity
from app.models.time_log import TimeLog, TimeLogStatus, TimeLogType
from app.models.user import User

BEIJING = timedelta(hours=8)
DAY = timedelta(days=1)


def midnight_utc(day: date) -> datetime:
    return datetime.combine(day, time.min) - BEIJING


def local_day(stamp: datetime) -> date:
    return (stamp + BEIJING).date()


def period_window(kind: str, anchor: date) -> tuple[date, date]:
    """Half-open calendar window; five-year blocks include 2021–25 and 2026–30."""
    if kind == "week":
        start = anchor - timedelta(days=anchor.weekday())
        return start, start + 7 * DAY
    if kind == "year":
        return date(anchor.year, 1, 1), date(anchor.year + 1, 1, 1)
    if kind == "five_year":
        year = anchor.year - (anchor.year - 1) % 5
        return date(year, 1, 1), date(year + 5, 1, 1)
    months = 3 if kind == "quarter" else 1
    month = (anchor.month - 1) // months * months + 1
    start = date(anchor.year, month, 1)
    following = month - 1 + months
    return start, date(anchor.year + following // 12, following % 12 + 1, 1)


@dataclass
class Entry:
    id: UUID
    goal_id: UUID | None
    title: str
    category: str
    note: str
    start_time: datetime
    end_time: datetime | None
    state: str
    is_plan: bool


async def entries_between(db: AsyncSession, user_id: UUID, start: datetime, end: datetime) -> list[Entry]:
    if end <= start:
        return []
    logs = await db.execute(
        select(TimeLog, Goal.title).outerjoin(
            Goal, and_(Goal.id == TimeLog.goal_id, Goal.user_id == user_id)
        ).where(TimeLog.user_id == user_id, TimeLog.start_time < end,
                or_(TimeLog.end_time > start, TimeLog.is_running.is_(True)))
    )
    entries = []
    for log, title in logs:
        is_plan = log.log_type == TimeLogType.PLANNED
        state = "actual"
        if log.is_running:
            state = "running"
        elif is_plan and log.status != TimeLogStatus.COMPLETED:
            state = "skipped" if log.status == TimeLogStatus.NOT_COMPLETED else "planned"
        entries.append(Entry(log.id, log.goal_id, title or "", "goal", log.note or "",
                             log.start_time, log.end_time, state, is_plan))
    daily = await db.scalars(select(DailyActivity).where(
        DailyActivity.user_id == user_id, DailyActivity.start_time < end, DailyActivity.end_time > start
    ))
    for row in daily:
        entries.append(Entry(row.id, None, "", row.category, row.note, row.start_time, row.end_time, "actual", False))
    return sorted(entries, key=lambda e: (e.start_time, str(e.id)))


async def assert_free_interval(db, user_id, start, end, exclude=None):
    # Serialize guarded captures until the caller's commit. A no-op UPDATE
    # also acquires a write lock in SQLite, where SELECT FOR UPDATE does not.
    await db.execute(update(User).where(User.id == user_id).values(updated_at=User.updated_at))
    entries = await entries_between(db, user_id, start, end)
    if any(e.id != exclude and e.state != "skipped" for e in entries):
        raise HTTPException(409, "This interval already contains an entry or plan")


def union(intervals):
    """Coalesce overlaps so that ten minutes on a clock count at most once."""
    merged = []
    for start, end in sorted(intervals):
        if end <= start:
            continue
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def minutes(intervals):
    return round(sum((end - start).total_seconds() for start, end in union(intervals)) / 60, 2)


def overlap_minutes(actual, covered):
    raw = sum((end - start).total_seconds() for _, start, end in actual) / 60
    return max(0.0, round(raw - covered, 2))


def actual_intervals(entries, start, end):
    for entry in entries:
        if entry.state == "actual" and entry.end_time:
            left, right = max(start, entry.start_time), min(end, entry.end_time)
            if left < right:
                yield entry, left, right


def day_summary(entries, day, now):
    start = midnight_utc(day)
    cutoff = max(start, min(start + DAY, now))
    actual = list(actual_intervals(entries, start, cutoff))
    busy = [(max(start, e.start_time), min(cutoff, e.end_time or now))
            for e in entries if e.state != "skipped"]
    cursor = start
    gaps = []
    for left, right in [*union(busy), (cutoff, cutoff)]:
        # Round inward. Sub-minute edges never suggest overlapping a finished log.
        first = ceil((cursor - start).total_seconds() / 60)
        last = floor((left - start).total_seconds() / 60)
        if last > first:
            gaps.append({"start_minute": first, "end_minute": last})
        cursor = max(cursor, right)
    covered = minutes((a, b) for _, a, b in actual)
    return {
        "day": day, "entries": entries, "gaps": gaps,
        "actual_minutes": covered, "overlap_minutes": overlap_minutes(actual, covered),
        "goal_minutes": minutes((a, b) for e, a, b in actual if e.goal_id),
        "life_minutes": minutes((a, b) for e, a, b in actual if not e.goal_id),
    }
