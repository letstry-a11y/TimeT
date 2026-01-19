import asyncio
from typing import Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.worker.celery_app import celery_app
from app.core.config import settings
from app.models.goal import Goal, GoalType
from app.models.time_log import TimeLog
from sqlalchemy import func, and_


def get_async_session():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def _aggregate_goal_progress(goal_id: str) -> dict:
    """Aggregate progress for a single goal."""
    AsyncSessionLocal = get_async_session()

    async with AsyncSessionLocal() as db:
        goal_uuid = UUID(goal_id)

        # Get total minutes for the goal
        result = await db.execute(
            select(func.sum(TimeLog.duration_minutes))
            .where(
                and_(
                    TimeLog.goal_id == goal_uuid,
                    TimeLog.is_running == False,
                )
            )
        )
        total_minutes = result.scalar_one_or_none() or 0
        total_hours = float(total_minutes) / 60

        # Update goal
        goal_result = await db.execute(
            select(Goal).where(Goal.id == goal_uuid)
        )
        goal = goal_result.scalar_one_or_none()

        if goal:
            goal.accumulated_hours = total_hours
            if goal.target_hours and goal.target_hours > 0:
                goal.progress_percentage = min(
                    100.0, (total_hours / float(goal.target_hours)) * 100
                )
            await db.commit()

            return {
                "goal_id": goal_id,
                "accumulated_hours": total_hours,
                "progress_percentage": float(goal.progress_percentage),
            }

    return {"goal_id": goal_id, "status": "not_found"}


async def _aggregate_all_goals() -> dict:
    """Aggregate progress for all goals."""
    AsyncSessionLocal = get_async_session()

    async with AsyncSessionLocal() as db:
        # Get all quarterly goals
        result = await db.execute(
            select(Goal).where(Goal.goal_type == GoalType.QUARTERLY)
        )
        goals = result.scalars().all()

        updated_count = 0
        for goal in goals:
            # Get total minutes
            time_result = await db.execute(
                select(func.sum(TimeLog.duration_minutes))
                .where(
                    and_(
                        TimeLog.goal_id == goal.id,
                        TimeLog.is_running == False,
                    )
                )
            )
            total_minutes = time_result.scalar_one_or_none() or 0
            total_hours = float(total_minutes) / 60

            goal.accumulated_hours = total_hours
            if goal.target_hours and goal.target_hours > 0:
                goal.progress_percentage = min(
                    100.0, (total_hours / float(goal.target_hours)) * 100
                )
            updated_count += 1

        await db.commit()

        # Now update yearly goals (parent goals)
        yearly_result = await db.execute(
            select(Goal).where(Goal.goal_type == GoalType.YEARLY)
        )
        yearly_goals = yearly_result.scalars().all()

        for yearly_goal in yearly_goals:
            # Sum children's hours
            children_result = await db.execute(
                select(func.sum(Goal.accumulated_hours))
                .where(Goal.parent_id == yearly_goal.id)
            )
            children_hours = children_result.scalar_one_or_none() or 0

            yearly_goal.accumulated_hours = float(children_hours)
            if yearly_goal.target_hours and yearly_goal.target_hours > 0:
                yearly_goal.progress_percentage = min(
                    100.0, (float(children_hours) / float(yearly_goal.target_hours)) * 100
                )

        await db.commit()

    return {"status": "completed", "updated_goals": updated_count}


@celery_app.task(name="app.worker.tasks.progress.aggregate_goal_progress")
def aggregate_goal_progress(goal_id: str) -> dict:
    """Celery task to aggregate progress for a single goal."""
    return asyncio.run(_aggregate_goal_progress(goal_id))


@celery_app.task(name="app.worker.tasks.progress.aggregate_all_goal_progress")
def aggregate_all_goal_progress() -> dict:
    """Celery task to aggregate progress for all goals (periodic task)."""
    return asyncio.run(_aggregate_all_goals())
