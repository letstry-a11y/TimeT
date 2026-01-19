import uuid
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud import timelog as timelog_crud
from app.crud import goal as goal_crud
from app.models.goal import GoalType


async def validate_goal_for_tracking(
    db: AsyncSession,
    user_id: uuid.UUID,
    goal_id: uuid.UUID,
) -> None:
    """
    Validate that a goal exists and is a quarterly goal (time can only be logged to quarterly goals).
    """
    goal = await goal_crud.get_goal(db, goal_id, user_id)
    if goal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )

    if goal.goal_type != GoalType.QUARTERLY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Time can only be logged to quarterly goals",
        )

    if goal.is_archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot log time to archived goals",
        )


async def check_no_running_session(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> None:
    """
    Ensure user doesn't have an active running session before starting a new one.
    """
    running = await timelog_crud.get_running_timelog(db, user_id)
    if running:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an active time tracking session. Stop it before starting a new one.",
        )


async def update_goal_accumulated_hours(
    db: AsyncSession,
    goal_id: uuid.UUID,
) -> None:
    """
    Update the accumulated hours for a goal after a time log is added/updated/deleted.
    This also updates the parent yearly goal's accumulated hours.
    """
    # Get total hours for the quarterly goal
    total_hours = await timelog_crud.get_total_hours_for_goal(db, goal_id)

    # Get the goal
    from sqlalchemy import select
    from app.models.goal import Goal

    result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()

    if goal:
        # Update quarterly goal
        await goal_crud.update_goal_progress(db, goal, total_hours)

        # Update parent (yearly) goal if exists
        if goal.parent_id:
            # Get all children of the parent
            parent_result = await db.execute(
                select(Goal).where(Goal.id == goal.parent_id)
            )
            parent = parent_result.scalar_one_or_none()

            if parent:
                # Sum up all children's accumulated hours
                children_result = await db.execute(
                    select(Goal).where(Goal.parent_id == parent.id)
                )
                children = children_result.scalars().all()

                parent_total = sum(float(c.accumulated_hours) for c in children)
                await goal_crud.update_goal_progress(db, parent, parent_total)
