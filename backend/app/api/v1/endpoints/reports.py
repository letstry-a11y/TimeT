from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, or_, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from app.db.session import get_db
from app.api.deps import get_current_user
from app.schemas.report import (
    VisionAlignmentReport,
    VisionAlignmentItem,
    GoalProgressReport,
    GoalProgressItem,
    WeeklyReport,
    DailyStats,
    PeriodReport,
    PeriodGoalItem,
)
from app.models.user import User
from app.models.vision import Vision
from app.models.goal import Goal, GoalType
from app.models.time_log import TimeLog, TimeLogType, TimeLogStatus

router = APIRouter()


@router.get("/vision-alignment", response_model=VisionAlignmentReport)
async def get_vision_alignment_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get vision alignment report showing time distribution across visions.
    """
    # Get all visions for user (sorted by sort_order)
    visions_result = await db.execute(
        select(Vision)
        .where(Vision.user_id == current_user.id)
        .order_by(Vision.sort_order, Vision.created_at.desc())
    )
    visions = visions_result.scalars().all()

    report_data = []
    total_hours = 0

    for vision in visions:
        # Get all yearly goals under this vision
        yearly_goals_result = await db.execute(
            select(Goal).where(
                and_(
                    Goal.vision_id == vision.id,
                    Goal.goal_type == GoalType.YEARLY,
                )
            )
        )
        yearly_goals = yearly_goals_result.scalars().all()

        vision_hours = 0
        for yearly_goal in yearly_goals:
            # Get quarterly goals under yearly goal
            quarterly_result = await db.execute(
                select(Goal.id).where(Goal.parent_id == yearly_goal.id)
            )
            quarterly_ids = [row[0] for row in quarterly_result.all()]

            if quarterly_ids:
                # Sum time logs for quarterly goals
                # Only count: clock_in, manual, or planned with completed status
                time_query = select(func.sum(TimeLog.duration_minutes)).where(
                    and_(
                        TimeLog.goal_id.in_(quarterly_ids),
                        TimeLog.is_running.is_(False),
                        or_(
                            TimeLog.log_type != TimeLogType.PLANNED,
                            TimeLog.status == TimeLogStatus.COMPLETED,
                        )
                    )
                )
                if start_date:
                    time_query = time_query.where(
                        TimeLog.start_time >= datetime.combine(start_date, datetime.min.time())
                    )
                if end_date:
                    time_query = time_query.where(
                        TimeLog.start_time <= datetime.combine(end_date, datetime.max.time())
                    )

                time_result = await db.execute(time_query)
                minutes = time_result.scalar_one_or_none() or 0
                vision_hours += float(minutes) / 60

        total_hours += vision_hours
        report_data.append(VisionAlignmentItem(
            vision_id=str(vision.id),
            vision_title=vision.title,
            hours=round(vision_hours, 2),
            percentage=0,
        ))

    # Calculate percentages
    if total_hours > 0:
        for item in report_data:
            item.percentage = round((item.hours / total_hours) * 100, 2)

    return VisionAlignmentReport(
        generated_at=datetime.utcnow(),
        total_hours=round(total_hours, 2),
        data=report_data,
    )


@router.get("/goal-progress", response_model=GoalProgressReport)
async def get_goal_progress_report(
    year: int = Query(...),
    quarter: Optional[int] = Query(None, ge=1, le=4),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get goal progress report for a specific year and optional quarter.
    """
    query = select(Goal).where(
        and_(
            Goal.user_id == current_user.id,
            Goal.year == year,
        )
    )

    if quarter:
        query = query.where(Goal.quarter == quarter)

    # Join with parent goal to sort quarterly goals by parent's sort_order
    ParentGoal = aliased(Goal)
    query = query.outerjoin(ParentGoal, Goal.parent_id == ParentGoal.id)
    query = query.order_by(
        # Yearly goals first, then quarterly
        Goal.goal_type,
        # Sort by parent's sort_order (yearly goals sort by own sort_order since parent is null)
        case(
            (Goal.parent_id.is_(None), Goal.sort_order),
            else_=ParentGoal.sort_order,
        ),
        Goal.sort_order,
    )
    result = await db.execute(query)
    goals = result.scalars().all()

    report_data = []
    for goal in goals:
        report_data.append(GoalProgressItem(
            goal_id=str(goal.id),
            title=goal.title,
            goal_type=goal.goal_type.value,
            status=goal.status.value,
            target_hours=float(goal.target_hours) if goal.target_hours else None,
            accumulated_hours=float(goal.accumulated_hours),
            progress_percentage=float(goal.progress_percentage),
            quarter=goal.quarter,
        ))

    return GoalProgressReport(
        generated_at=datetime.utcnow(),
        year=year,
        quarter=quarter,
        data=report_data,
    )


@router.get("/weekly", response_model=WeeklyReport)
async def get_weekly_report(
    week_start: Optional[date] = Query(None, description="Start date of the week (Monday)"),
    tz_offset: Optional[int] = Query(None, description="Timezone offset in minutes (e.g., 480 for UTC+8)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get weekly time tracking report.
    If week_start is not provided, uses the current week.
    tz_offset: Timezone offset in minutes from UTC (e.g., 480 for UTC+8, -300 for UTC-5)
    """
    # Default to UTC if no timezone offset provided
    tz_offset_minutes = tz_offset or 0
    tz_delta = timedelta(minutes=tz_offset_minutes)

    if week_start is None:
        # Calculate today in user's timezone
        utc_now = datetime.utcnow()
        user_local_now = utc_now + tz_delta
        today = user_local_now.date()
        week_start = today - timedelta(days=today.weekday())

    week_end = week_start + timedelta(days=6)

    # Get daily breakdown
    daily_stats = []
    for i in range(7):
        day = week_start + timedelta(days=i)
        # Calculate day boundaries in UTC by subtracting timezone offset
        # e.g., for UTC+8: local 00:00 = UTC 16:00 (previous day)
        day_start_local = datetime.combine(day, datetime.min.time())
        day_end_local = datetime.combine(day, datetime.max.time())
        # Convert local time boundaries to UTC for database query
        day_start = day_start_local - tz_delta
        day_end = day_end_local - tz_delta

        # Only count: clock_in, manual, or planned with completed status
        result = await db.execute(
            select(
                func.sum(TimeLog.duration_minutes).label("total_minutes"),
                func.count(TimeLog.id).label("log_count"),
            ).where(
                and_(
                    TimeLog.user_id == current_user.id,
                    TimeLog.start_time >= day_start,
                    TimeLog.start_time <= day_end,
                    TimeLog.is_running.is_(False),
                    or_(
                        TimeLog.log_type != TimeLogType.PLANNED,
                        and_(
                            TimeLog.log_type == TimeLogType.PLANNED,
                            TimeLog.status == TimeLogStatus.COMPLETED
                        )
                    )
                )
            )
        )
        row = result.one()

        daily_stats.append(DailyStats(
            date=day,
            hours=round(float(row.total_minutes or 0) / 60, 2),
            log_count=row.log_count or 0,
        ))

    total_hours = sum(d.hours for d in daily_stats)

    # Get top goals for the week (only count completed time)
    # Calculate week boundaries in UTC
    week_start_utc = datetime.combine(week_start, datetime.min.time()) - tz_delta
    week_end_utc = datetime.combine(week_end, datetime.max.time()) - tz_delta

    top_goals_result = await db.execute(
        select(
            Goal.id,
            Goal.title,
            func.sum(TimeLog.duration_minutes).label("total_minutes"),
        )
        .join(TimeLog, TimeLog.goal_id == Goal.id)
        .where(
            and_(
                TimeLog.user_id == current_user.id,
                TimeLog.start_time >= week_start_utc,
                TimeLog.start_time <= week_end_utc,
                TimeLog.is_running.is_(False),
                or_(
                    TimeLog.log_type != TimeLogType.PLANNED,
                    and_(
                        TimeLog.log_type == TimeLogType.PLANNED,
                        TimeLog.status == TimeLogStatus.COMPLETED
                    )
                )
            )
        )
        .group_by(Goal.id, Goal.title)
        .order_by(func.sum(TimeLog.duration_minutes).desc())
        .limit(5)
    )

    top_goals = [
        {
            "goal_id": str(row.id),
            "title": row.title,
            "hours": round(float(row.total_minutes or 0) / 60, 2),
        }
        for row in top_goals_result.all()
    ]

    return WeeklyReport(
        start_date=week_start,
        end_date=week_end,
        total_hours=round(total_hours, 2),
        daily_breakdown=daily_stats,
        top_goals=top_goals,
    )


@router.get("/period", response_model=PeriodReport)
async def get_period_report(
    year: int = Query(..., ge=1, le=9998),
    quarter: Optional[int] = Query(None, ge=1, le=4),
    as_of: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Beijing start-date totals vs goal totals, without counting annual parents twice."""
    today = as_of or (datetime.utcnow() + timedelta(hours=8)).date()
    month = 3 * quarter - 2 if quarter else 1
    begin = date(year, month, 1)
    finish = date(year + 1, 1, 1) if not quarter or quarter == 4 else date(year, month + 3, 1)
    cutoff = min(today + timedelta(days=1), finish)
    all_goals = (await db.execute(select(Goal).where(Goal.user_id == current_user.id))).scalars().all()
    by_id = {g.id: g for g in all_goals}
    selected = sorted([g for g in all_goals if g.year == year and g.goal_type == GoalType.QUARTERLY
                       and (quarter is None or g.quarter == quarter)], key=lambda g: (g.sort_order, g.title))
    logs = (await db.execute(select(TimeLog).where(
        TimeLog.user_id == current_user.id,
        TimeLog.start_time >= datetime.combine(begin, datetime.min.time()) - timedelta(hours=8),
        TimeLog.start_time < datetime.combine(cutoff, datetime.min.time()) - timedelta(hours=8),
        TimeLog.is_running.is_(False),
        or_(TimeLog.log_type != TimeLogType.PLANNED, TimeLog.status == TimeLogStatus.COMPLETED),
    ))).scalars().all()
    anchor = min(today, finish - timedelta(days=1))
    week_start = anchor - timedelta(days=anchor.weekday())
    remaining = max(0, (finish - max(today + timedelta(days=1), begin)).days)
    elapsed = max(0, min((cutoff - begin).days, (finish - begin).days))
    totals_result = await db.execute(select(TimeLog.goal_id, func.sum(TimeLog.duration_minutes)).where(
        TimeLog.user_id == current_user.id,
        TimeLog.is_running.is_(False),
        or_(TimeLog.log_type != TimeLogType.PLANNED, TimeLog.status == TimeLogStatus.COMPLETED),
    ).group_by(TimeLog.goal_id))
    totals = {gid: float(minutes or 0)/60 for gid, minutes in totals_result.all()}
    rows = []
    for g in selected:
        own = [r for r in logs if r.goal_id == g.id]
        local_days = [(r.start_time + timedelta(hours=8)).date() for r in own]
        target = float(g.target_hours) if g.target_hours is not None else None
        hours = totals.get(g.id, 0.0)
        rows.append(PeriodGoalItem(
            goal_id=str(g.id), title=g.title, goal_hours=round(hours, 2),
            calendar_hours=round(sum(float(r.duration_minutes or 0) for r in own)/60, 2),
            target_hours=target, raw_percentage=round(hours/target*100, 1) if target else None,
            active_days_this_week=len({d for d in local_days if d >= week_start}),
            last_record=max(local_days).isoformat() if local_days else None,
            remaining_hours_per_week=round(max(0, target-hours)*7/remaining, 2) if target is not None and remaining else None,
            acceptance=g.description,
        ))
    cross = 0
    for r in logs:
        g = by_id.get(r.goal_id)
        local = r.start_time + timedelta(hours=8)
        if g and (g.year, g.quarter) != (local.year, (local.month-1)//3+1):
            cross += 1
    return PeriodReport(
        start_date=begin, end_date=finish-timedelta(days=1), as_of=today, week_start=week_start,
        calendar_hours=round(sum(float(r.duration_minutes or 0) for r in logs)/60, 2),
        goal_hours=round(sum(totals.get(g.id, 0.0) for g in selected), 2),
        target_hours=round(sum(r.target_hours or 0 for r in rows), 2),
        elapsed_percentage=round(elapsed/(finish-begin).days*100, 1),
        cross_period_log_count=cross, goals=rows,
    )
