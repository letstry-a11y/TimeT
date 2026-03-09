import uuid
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.api.deps import get_current_user
from app.schemas.timelog import (
    TimeLogStart,
    TimeLogManual,
    TimeLogPlanned,
    TimeLogStop,
    TimeLogUpdate,
    TimeLogResponse,
    TimeLogStats,
    TimeLogStatusUpdate,
)
from app.crud import timelog as timelog_crud
from app.services.time_tracking import (
    validate_goal_for_tracking,
    check_no_running_session,
    update_goal_accumulated_hours,
)
from app.models.user import User
from app.models.time_log import TimeLogType

router = APIRouter()


@router.get("", response_model=List[TimeLogResponse])
async def list_timelogs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    goal_id: Optional[uuid.UUID] = Query(None),
    task_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    log_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get time logs for the current user with optional filters.
    """
    # Normalize log_type to lowercase for case-insensitive matching
    log_type_enum = None
    if log_type:
        try:
            log_type_enum = TimeLogType(log_type.lower())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid log_type: {log_type}. Must be one of: clock_in, manual, planned",
            )

    timelogs = await timelog_crud.get_timelogs(
        db,
        current_user.id,
        skip,
        limit,
        goal_id,
        task_id,
        start_date,
        end_date,
        log_type_enum,
    )
    return timelogs


@router.get("/current", response_model=Optional[TimeLogResponse])
async def get_current_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the currently running time tracking session (if any)."""
    timelog = await timelog_crud.get_running_timelog(db, current_user.id)
    return timelog


@router.post("/start", response_model=TimeLogResponse, status_code=status.HTTP_201_CREATED)
async def start_clock_in(
    timelog_in: TimeLogStart,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Start a new clock-in session.
    - Only one active session allowed per user
    - Time can only be logged to quarterly goals
    """
    # Validate goal
    await validate_goal_for_tracking(db, current_user.id, timelog_in.goal_id)

    # Check no running session
    await check_no_running_session(db, current_user.id)

    timelog = await timelog_crud.create_clock_in(
        db,
        current_user.id,
        timelog_in.goal_id,
        timelog_in.task_id,
        timelog_in.note,
        timelog_in.tags,
    )
    return timelog


@router.patch("/{timelog_id}/stop", response_model=TimeLogResponse)
async def stop_clock_in(
    timelog_id: uuid.UUID,
    stop_data: TimeLogStop,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stop an active clock-in session."""
    timelog = await timelog_crud.get_timelog(db, timelog_id, current_user.id)
    if timelog is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time log not found",
        )

    if not timelog.is_running:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This time log is not currently running",
        )

    timelog = await timelog_crud.stop_clock_in(db, timelog, stop_data.note)

    # Update goal accumulated hours
    await update_goal_accumulated_hours(db, timelog.goal_id)

    return timelog


@router.post("", response_model=TimeLogResponse, status_code=status.HTTP_201_CREATED)
async def create_manual_entry(
    timelog_in: TimeLogManual,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a manual time entry.
    - Time can only be logged to quarterly goals
    """
    # Validate goal
    await validate_goal_for_tracking(db, current_user.id, timelog_in.goal_id)

    timelog = await timelog_crud.create_manual_entry(db, current_user.id, timelog_in)

    # Update goal accumulated hours
    await update_goal_accumulated_hours(db, timelog.goal_id)

    return timelog


@router.post("/planned", response_model=TimeLogResponse, status_code=status.HTTP_201_CREATED)
async def create_planned_entry(
    timelog_in: TimeLogPlanned,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a planned task entry.
    - Time can only be planned for quarterly goals
    - Planned tasks start with 'pending' status
    """
    # Validate goal
    await validate_goal_for_tracking(db, current_user.id, timelog_in.goal_id)

    timelog = await timelog_crud.create_planned(db, current_user.id, timelog_in)

    return timelog


@router.patch("/{timelog_id}/status", response_model=TimeLogResponse)
async def update_timelog_status(
    timelog_id: uuid.UUID,
    status_update: TimeLogStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the status of a planned task.
    - Only planned tasks can have their status updated
    """
    timelog = await timelog_crud.get_timelog(db, timelog_id, current_user.id)
    if timelog is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time log not found",
        )

    if timelog.log_type != TimeLogType.PLANNED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only planned tasks can have their status updated",
        )

    timelog = await timelog_crud.update_status(db, timelog, status_update.status)

    # Update goal accumulated hours when status changes
    # (time should be added when completed, removed when changed from completed)
    await update_goal_accumulated_hours(db, timelog.goal_id)

    return timelog


@router.get("/{timelog_id}", response_model=TimeLogResponse)
async def get_timelog(
    timelog_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific time log by ID."""
    timelog = await timelog_crud.get_timelog(db, timelog_id, current_user.id)
    if timelog is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time log not found",
        )
    return timelog


@router.put("/{timelog_id}", response_model=TimeLogResponse)
async def update_timelog(
    timelog_id: uuid.UUID,
    timelog_in: TimeLogUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a time log."""
    timelog = await timelog_crud.get_timelog(db, timelog_id, current_user.id)
    if timelog is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time log not found",
        )

    if timelog.is_running:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update a running time log. Stop it first.",
        )

    # If changing goal, validate new goal
    if timelog_in.goal_id and timelog_in.goal_id != timelog.goal_id:
        await validate_goal_for_tracking(db, current_user.id, timelog_in.goal_id)

    old_goal_id = timelog.goal_id
    timelog = await timelog_crud.update_timelog(db, timelog, timelog_in)

    # Update goal accumulated hours for both old and new goals
    await update_goal_accumulated_hours(db, timelog.goal_id)
    if timelog_in.goal_id and timelog_in.goal_id != old_goal_id:
        await update_goal_accumulated_hours(db, old_goal_id)

    return timelog


@router.delete("/{timelog_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_timelog(
    timelog_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a time log."""
    timelog = await timelog_crud.get_timelog(db, timelog_id, current_user.id)
    if timelog is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time log not found",
        )

    goal_id = timelog.goal_id
    await timelog_crud.delete_timelog(db, timelog)

    # Update goal accumulated hours
    await update_goal_accumulated_hours(db, goal_id)


@router.get("/stats/summary", response_model=TimeLogStats)
async def get_timelog_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    goal_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get time tracking statistics summary."""
    stats = await timelog_crud.get_stats(
        db, current_user.id, start_date, end_date, goal_id
    )
    return TimeLogStats(
        total_minutes=stats["total_minutes"],
        total_hours=stats["total_hours"],
        log_count=stats["log_count"],
    )
