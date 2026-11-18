import uuid
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.goal import Goal, GoalType
from app.crud import goal as goal_crud
from app.crud import vision as vision_crud


async def validate_goal_hierarchy(
    db: AsyncSession,
    user_id: uuid.UUID,
    goal_type: GoalType,
    vision_id: Optional[uuid.UUID] = None,
    parent_id: Optional[uuid.UUID] = None,
    year: Optional[int] = None,
) -> None:
    """
    Validate goal hierarchy rules:
    - Yearly goals MUST be linked to a vision
    - Quarterly goals MUST be linked to a yearly goal (parent_id)
    """

    if goal_type == GoalType.YEARLY:
        # Yearly goals must have a vision
        if vision_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Yearly goals must be linked to a vision",
            )
        # Verify vision exists and belongs to user
        vision = await vision_crud.get_vision(db, vision_id, user_id)
        if vision is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vision not found",
            )

    elif goal_type == GoalType.QUARTERLY:
        # Quarterly goals must have a parent (yearly goal)
        if parent_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quarterly goals must be linked to a yearly goal",
            )
        # Verify parent exists and is a yearly goal
        parent = await goal_crud.get_goal(db, parent_id, user_id)
        if parent is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent goal not found",
            )
        if parent.goal_type != GoalType.YEARLY:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quarterly goals can only be children of yearly goals",
            )

        if year is not None and parent.year != year:
            raise HTTPException(status_code=400, detail="Quarterly goal year must match its parent year")


async def build_goal_tree(
    db: AsyncSession, user_id: uuid.UUID, goal: Goal
) -> dict:
    """Build a tree structure for a goal and its children."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.children), selectinload(Goal.vision))
        .where(Goal.id == goal.id)
    )
    goal_with_relations = result.scalar_one_or_none()

    if goal_with_relations is None:
        return {}

    async def build_children_tree(g: Goal) -> dict:
        tree = {
            "id": g.id,
            "title": g.title,
            "description": g.description,
            "goal_type": g.goal_type,
            "status": g.status,
            "year": g.year,
            "quarter": g.quarter,
            "target_hours": float(g.target_hours) if g.target_hours else None,
            "accumulated_hours": float(g.accumulated_hours),
            "progress_percentage": float(g.progress_percentage),
            "vision_id": g.vision_id,
            "parent_id": g.parent_id,
            "vision_title": g.vision.title if g.vision else None,
            "children": [],
        }

        if g.children:
            for child in g.children:
                child_tree = await build_children_tree(child)
                tree["children"].append(child_tree)

        return tree

    return await build_children_tree(goal_with_relations)
