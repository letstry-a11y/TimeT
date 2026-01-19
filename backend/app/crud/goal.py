import uuid
from typing import List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.goal import Goal, GoalType
from app.schemas.goal import GoalCreate, GoalUpdate


async def get_goal(
    db: AsyncSession, goal_id: uuid.UUID, user_id: uuid.UUID
) -> Optional[Goal]:
    result = await db.execute(
        select(Goal).where(
            and_(Goal.id == goal_id, Goal.user_id == user_id)
        )
    )
    return result.scalar_one_or_none()


async def get_goal_with_children(
    db: AsyncSession, goal_id: uuid.UUID, user_id: uuid.UUID
) -> Optional[Goal]:
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.children))
        .where(and_(Goal.id == goal_id, Goal.user_id == user_id))
    )
    return result.scalar_one_or_none()


async def get_goals(
    db: AsyncSession,
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    vision_id: Optional[uuid.UUID] = None,
    goal_type: Optional[GoalType] = None,
    year: Optional[int] = None,
    quarter: Optional[int] = None,
    parent_id: Optional[uuid.UUID] = None,
    include_archived: bool = False,
) -> List[Goal]:
    query = select(Goal).where(Goal.user_id == user_id)

    if vision_id is not None:
        query = query.where(Goal.vision_id == vision_id)
    if goal_type is not None:
        query = query.where(Goal.goal_type == goal_type)
    if year is not None:
        query = query.where(Goal.year == year)
    if quarter is not None:
        query = query.where(Goal.quarter == quarter)
    if parent_id is not None:
        query = query.where(Goal.parent_id == parent_id)
    if not include_archived:
        query = query.where(Goal.is_archived == False)

    query = query.order_by(Goal.sort_order, Goal.created_at.desc())
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_yearly_goals(
    db: AsyncSession, user_id: uuid.UUID, year: int
) -> List[Goal]:
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.children))
        .where(
            and_(
                Goal.user_id == user_id,
                Goal.goal_type == GoalType.YEARLY,
                Goal.year == year,
                Goal.is_archived == False,
            )
        )
        .order_by(Goal.sort_order)
    )
    return list(result.scalars().all())


async def create_goal(
    db: AsyncSession, user_id: uuid.UUID, goal_in: GoalCreate
) -> Goal:
    goal = Goal(
        user_id=user_id,
        **goal_in.model_dump()
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal


async def update_goal(
    db: AsyncSession, goal: Goal, goal_in: GoalUpdate
) -> Goal:
    update_data = goal_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(goal, field, value)
    await db.commit()
    await db.refresh(goal)
    return goal


async def update_goal_progress(
    db: AsyncSession, goal: Goal, accumulated_hours: float
) -> Goal:
    goal.accumulated_hours = accumulated_hours
    if goal.target_hours and goal.target_hours > 0:
        goal.progress_percentage = min(
            100.0, (accumulated_hours / float(goal.target_hours)) * 100
        )
    await db.commit()
    await db.refresh(goal)
    return goal


async def delete_goal(db: AsyncSession, goal: Goal) -> None:
    await db.delete(goal)
    await db.commit()
