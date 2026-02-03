import asyncio
from datetime import datetime
from typing import Optional
from uuid import UUID
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.worker.celery_app import celery_app
from app.core.config import settings
from app.models.goal import Goal, GoalType
from app.models.vision import Vision
from app.models.time_log import TimeLog


def get_async_session():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def _generate_vision_alignment_report(
    user_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> dict:
    """Generate a report showing time allocation across visions."""
    AsyncSessionLocal = get_async_session()

    async with AsyncSessionLocal() as db:
        user_uuid = UUID(user_id)

        # Parse dates
        start_dt = datetime.fromisoformat(start_date) if start_date else None
        end_dt = datetime.fromisoformat(end_date) if end_date else None

        # Get all visions for user
        visions_result = await db.execute(
            select(Vision).where(Vision.user_id == user_uuid)
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
                    time_query = select(func.sum(TimeLog.duration_minutes)).where(
                        and_(
                            TimeLog.goal_id.in_(quarterly_ids),
                            TimeLog.is_running.is_(False),
                        )
                    )
                    if start_dt:
                        time_query = time_query.where(TimeLog.start_time >= start_dt)
                    if end_dt:
                        time_query = time_query.where(TimeLog.start_time <= end_dt)

                    time_result = await db.execute(time_query)
                    minutes = time_result.scalar_one_or_none() or 0
                    vision_hours += float(minutes) / 60

            total_hours += vision_hours
            report_data.append({
                "vision_id": str(vision.id),
                "vision_title": vision.title,
                "hours": vision_hours,
                "percentage": 0,  # Will calculate after getting total
            })

        # Calculate percentages
        if total_hours > 0:
            for item in report_data:
                item["percentage"] = round((item["hours"] / total_hours) * 100, 2)

        return {
            "report_type": "vision_alignment",
            "generated_at": datetime.utcnow().isoformat(),
            "total_hours": total_hours,
            "data": report_data,
        }


async def _generate_goal_progress_report(
    user_id: str,
    year: int,
    quarter: Optional[int] = None,
) -> dict:
    """Generate a report showing goal progress."""
    AsyncSessionLocal = get_async_session()

    async with AsyncSessionLocal() as db:
        user_uuid = UUID(user_id)

        query = select(Goal).where(
            and_(
                Goal.user_id == user_uuid,
                Goal.year == year,
            )
        )

        if quarter:
            query = query.where(Goal.quarter == quarter)

        result = await db.execute(query)
        goals = result.scalars().all()

        report_data = []
        for goal in goals:
            report_data.append({
                "goal_id": str(goal.id),
                "title": goal.title,
                "goal_type": goal.goal_type.value,
                "status": goal.status.value,
                "target_hours": float(goal.target_hours) if goal.target_hours else None,
                "accumulated_hours": float(goal.accumulated_hours),
                "progress_percentage": float(goal.progress_percentage),
                "quarter": goal.quarter,
            })

        return {
            "report_type": "goal_progress",
            "generated_at": datetime.utcnow().isoformat(),
            "year": year,
            "quarter": quarter,
            "data": report_data,
        }


@celery_app.task(name="app.worker.tasks.reports.generate_vision_alignment_report")
def generate_vision_alignment_report(
    user_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> dict:
    """Celery task to generate vision alignment report."""
    return asyncio.run(_generate_vision_alignment_report(user_id, start_date, end_date))


@celery_app.task(name="app.worker.tasks.reports.generate_goal_progress_report")
def generate_goal_progress_report(
    user_id: str,
    year: int,
    quarter: Optional[int] = None,
) -> dict:
    """Celery task to generate goal progress report."""
    return asyncio.run(_generate_goal_progress_report(user_id, year, quarter))
