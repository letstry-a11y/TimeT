import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.api.deps import get_current_user
from app.schemas.goal import GoalCreate, GoalUpdate, GoalResponse, GoalWithChildren
from app.crud import goal as goal_crud
from app.services.goal_hierarchy import validate_goal_hierarchy, build_goal_tree
from app.models.user import User
from app.models.goal import GoalType

router = APIRouter()


@router.get("", response_model=List[GoalResponse])
async def list_goals(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    vision_id: Optional[uuid.UUID] = Query(None),
    goal_type: Optional[GoalType] = Query(None),
    year: Optional[int] = Query(None),
    quarter: Optional[int] = Query(None, ge=1, le=4),
    parent_id: Optional[uuid.UUID] = Query(None),
    include_archived: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get goals for the current user with optional filters.
    - vision_id: Filter by vision
    - goal_type: Filter by type (yearly/quarterly)
    - year: Filter by year
    - quarter: Filter by quarter (1-4)
    - parent_id: Filter by parent goal
    """
    goals = await goal_crud.get_goals(
        db,
        current_user.id,
        skip,
        limit,
        vision_id,
        goal_type,
        year,
        quarter,
        parent_id,
        include_archived,
    )
    return goals


@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal_in: GoalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new goal.
    - Yearly goals must be linked to a vision
    - Quarterly goals must be linked to a yearly goal (parent_id)
    """
    # Validate hierarchy rules
    await validate_goal_hierarchy(
        db, current_user.id, goal_in.goal_type, goal_in.vision_id, goal_in.parent_id, goal_in.year
    )

    goal = await goal_crud.create_goal(db, current_user.id, goal_in)
    return goal


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific goal by ID."""
    goal = await goal_crud.get_goal(db, goal_id, current_user.id)
    if goal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )
    return goal


@router.get("/{goal_id}/tree")
async def get_goal_tree(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a goal with its full hierarchical tree structure."""
    goal = await goal_crud.get_goal(db, goal_id, current_user.id)
    if goal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )

    tree = await build_goal_tree(db, current_user.id, goal)
    return tree


@router.get("/yearly/{year}", response_model=List[GoalWithChildren])
async def get_yearly_goals_with_children(
    year: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all yearly goals for a specific year with their quarterly children."""
    goals = await goal_crud.get_yearly_goals(db, current_user.id, year)
    return goals


@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: uuid.UUID,
    goal_in: GoalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a goal."""
    goal = await goal_crud.get_goal(db, goal_id, current_user.id)
    if goal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )

    # Validate the merged state even for partial updates and explicit nulls.
    from pydantic import ValidationError
    from sqlalchemy import select
    from app.models.goal import Goal
    merged = {field: getattr(goal, field) for field in GoalCreate.model_fields}
    merged.update(goal_in.model_dump(exclude_unset=True))
    try:
        candidate = GoalCreate(**merged)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    await validate_goal_hierarchy(db, current_user.id, candidate.goal_type,
                                  candidate.vision_id, candidate.parent_id, candidate.year)
    children = (await db.execute(select(Goal).where(Goal.parent_id == goal.id))).scalars().all()
    if children and (candidate.goal_type != GoalType.YEARLY or any(c.year != candidate.year for c in children)):
        raise HTTPException(status_code=400, detail="Parent type/year must remain consistent with its children")

    goal = await goal_crud.update_goal(db, goal, goal_in)
    return goal


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a goal and all its children."""
    goal = await goal_crud.get_goal(db, goal_id, current_user.id)
    if goal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )
    await goal_crud.delete_goal(db, goal)
