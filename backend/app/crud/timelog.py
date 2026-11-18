import uuid
from datetime import datetime, date
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.time_log import TimeLog, TimeLogType, TimeLogStatus
from app.schemas.timelog import TimeLogManual, TimeLogUpdate, TimeLogPlanned


def to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Convert timezone-aware datetime to naive UTC datetime.

    If the datetime has timezone info, it will be converted to UTC first,
    then the timezone info is removed.
    """
    if dt is None:
        return None
    if dt.tzinfo is not None:
        from datetime import timezone
        # Convert to UTC first, then remove timezone info
        utc_dt = dt.astimezone(timezone.utc)
        return utc_dt.replace(tzinfo=None)
    return dt


async def get_timelog(
    db: AsyncSession, timelog_id: uuid.UUID, user_id: uuid.UUID
) -> Optional[TimeLog]:
    result = await db.execute(
        select(TimeLog).where(
            and_(TimeLog.id == timelog_id, TimeLog.user_id == user_id)
        )
    )
    return result.scalar_one_or_none()


async def get_running_timelog(
    db: AsyncSession, user_id: uuid.UUID
) -> Optional[TimeLog]:
    """Get the currently running time log for a user (if any)."""
    result = await db.execute(
        select(TimeLog).where(
            and_(TimeLog.user_id == user_id, TimeLog.is_running.is_(True))
        )
    )
    return result.scalar_one_or_none()


async def get_timelogs(
    db: AsyncSession,
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    goal_id: Optional[uuid.UUID] = None,
    task_id: Optional[uuid.UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    log_type: Optional[TimeLogType] = None,
) -> List[TimeLog]:
    query = select(TimeLog).where(TimeLog.user_id == user_id)

    if goal_id is not None:
        query = query.where(TimeLog.goal_id == goal_id)
    if task_id is not None:
        query = query.where(TimeLog.task_id == task_id)
    if start_date is not None:
        query = query.where(TimeLog.start_time >= datetime.combine(start_date, datetime.min.time()))
    if end_date is not None:
        query = query.where(TimeLog.start_time <= datetime.combine(end_date, datetime.max.time()))
    if log_type is not None:
        query = query.where(TimeLog.log_type == log_type)

    query = query.order_by(TimeLog.start_time.desc())
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_clock_in(
    db: AsyncSession,
    user_id: uuid.UUID,
    goal_id: uuid.UUID,
    task_id: Optional[uuid.UUID] = None,
    note: Optional[str] = None,
    tags: Optional[str] = None,
) -> TimeLog:
    timelog = TimeLog(
        user_id=user_id,
        goal_id=goal_id,
        task_id=task_id,
        log_type=TimeLogType.CLOCK_IN,
        start_time=datetime.utcnow(),
        note=note,
        tags=tags,
        is_running=True,
    )
    db.add(timelog)
    await db.commit()
    await db.refresh(timelog)
    return timelog


async def stop_clock_in(
    db: AsyncSession,
    timelog: TimeLog,
    note: Optional[str] = None,
) -> TimeLog:
    end_time = datetime.utcnow()
    timelog.end_time = end_time
    timelog.is_running = False
    timelog.duration_minutes = (end_time - timelog.start_time).total_seconds() / 60
    if note is not None:
        timelog.note = note

    await db.commit()
    await db.refresh(timelog)
    return timelog


async def create_manual_entry(
    db: AsyncSession,
    user_id: uuid.UUID,
    timelog_in: TimeLogManual,
) -> TimeLog:
    timelog = TimeLog(
        user_id=user_id,
        goal_id=timelog_in.goal_id,
        task_id=timelog_in.task_id,
        log_type=TimeLogType.MANUAL,
        start_time=to_naive_utc(timelog_in.start_time),
        end_time=to_naive_utc(timelog_in.end_time),
        duration_minutes=timelog_in.duration_minutes,
        note=timelog_in.note,
        tags=timelog_in.tags,
        is_running=False,
    )
    db.add(timelog)
    await db.commit()
    await db.refresh(timelog)
    return timelog


async def create_planned(
    db: AsyncSession,
    user_id: uuid.UUID,
    timelog_in: TimeLogPlanned,
) -> TimeLog:
    """Create a planned task entry."""
    timelog = TimeLog(
        user_id=user_id,
        goal_id=timelog_in.goal_id,
        task_id=timelog_in.task_id,
        log_type=TimeLogType.PLANNED,
        status=TimeLogStatus.PENDING,
        start_time=to_naive_utc(timelog_in.start_time),
        end_time=to_naive_utc(timelog_in.end_time),
        duration_minutes=timelog_in.duration_minutes,
        note=timelog_in.note,
        tags=timelog_in.tags,
        is_running=False,
    )
    db.add(timelog)
    await db.commit()
    await db.refresh(timelog)
    return timelog


async def update_status(
    db: AsyncSession,
    timelog: TimeLog,
    status: TimeLogStatus,
) -> TimeLog:
    """Update the status of a planned task."""
    timelog.status = status
    await db.commit()
    await db.refresh(timelog)
    return timelog


async def update_timelog(
    db: AsyncSession, timelog: TimeLog, timelog_in: TimeLogUpdate
) -> TimeLog:
    update_data = timelog_in.model_dump(exclude_unset=True)

    # Convert timezone-aware datetimes to naive UTC
    if "start_time" in update_data:
        update_data["start_time"] = to_naive_utc(update_data["start_time"])
    if "end_time" in update_data:
        update_data["end_time"] = to_naive_utc(update_data["end_time"])

    if "goal_id" in update_data and update_data["goal_id"] is None:
        raise HTTPException(status_code=422, detail="Goal cannot be null")

    # Validate the merged record, including one-sided time updates.
    start = update_data.get("start_time", timelog.start_time)
    end = update_data.get("end_time", timelog.end_time)
    if not start or not end or end <= start:
        raise HTTPException(status_code=422, detail="End time must be after start time")
    minutes = (end - start).total_seconds() / 60
    if "duration_minutes" in update_data:
        supplied = update_data["duration_minutes"]
        if supplied is None or abs(float(supplied) - minutes) > 0.02:
            raise HTTPException(status_code=422, detail="Duration must match start/end times")
    if "start_time" in update_data or "end_time" in update_data or "duration_minutes" in update_data:
        update_data["duration_minutes"] = minutes

    for field, value in update_data.items():
        setattr(timelog, field, value)

    await db.commit()
    await db.refresh(timelog)
    return timelog


async def delete_timelog(db: AsyncSession, timelog: TimeLog) -> None:
    await db.delete(timelog)
    await db.commit()


async def get_total_hours_for_goal(
    db: AsyncSession, goal_id: uuid.UUID
) -> float:
    """Get total hours logged for a specific goal.

    Only counts:
    - Non-planned entries (CLOCK_IN, MANUAL)
    - Planned entries with status COMPLETED

    Does NOT count:
    - Planned entries with status PENDING or NOT_COMPLETED
    """
    from sqlalchemy import or_

    result = await db.execute(
        select(func.sum(TimeLog.duration_minutes))
        .where(
            and_(
                TimeLog.goal_id == goal_id,
                TimeLog.is_running.is_(False),
                or_(
                    TimeLog.log_type != TimeLogType.PLANNED,
                    TimeLog.status == TimeLogStatus.COMPLETED,
                )
            )
        )
    )
    total_minutes = result.scalar_one_or_none() or 0
    return float(total_minutes) / 60


async def get_stats(
    db: AsyncSession,
    user_id: uuid.UUID,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    goal_id: Optional[uuid.UUID] = None,
) -> dict:
    """Get time tracking statistics.

    Only counts:
    - Non-planned entries (CLOCK_IN, MANUAL)
    - Planned entries with status COMPLETED
    """
    from sqlalchemy import or_

    query = select(
        func.sum(TimeLog.duration_minutes).label("total_minutes"),
        func.count(TimeLog.id).label("log_count"),
    ).where(
        and_(
            TimeLog.user_id == user_id,
            TimeLog.is_running.is_(False),
            or_(
                TimeLog.log_type != TimeLogType.PLANNED,
                TimeLog.status == TimeLogStatus.COMPLETED,
            )
        )
    )

    if goal_id:
        query = query.where(TimeLog.goal_id == goal_id)
    if start_date:
        query = query.where(TimeLog.start_time >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.where(TimeLog.start_time <= datetime.combine(end_date, datetime.max.time()))

    result = await db.execute(query)
    row = result.one()

    total_minutes = float(row.total_minutes or 0)

    return {
        "total_minutes": total_minutes,
        "total_hours": total_minutes / 60,
        "log_count": row.log_count or 0,
    }
