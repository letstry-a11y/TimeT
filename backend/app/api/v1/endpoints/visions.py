import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.api.deps import get_current_user
from app.schemas.vision import VisionCreate, VisionUpdate, VisionResponse, VisionWithGoals
from app.crud import vision as vision_crud
from app.models.user import User

router = APIRouter()


@router.get("", response_model=List[VisionResponse])
async def list_visions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    include_archived: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all visions for the current user."""
    visions = await vision_crud.get_visions(
        db, current_user.id, skip, limit, include_archived
    )
    return visions


@router.post("", response_model=VisionResponse, status_code=status.HTTP_201_CREATED)
async def create_vision(
    vision_in: VisionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new vision."""
    vision = await vision_crud.create_vision(db, current_user.id, vision_in)
    return vision


@router.get("/{vision_id}", response_model=VisionResponse)
async def get_vision(
    vision_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific vision by ID."""
    vision = await vision_crud.get_vision(db, vision_id, current_user.id)
    if vision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vision not found",
        )
    return vision


@router.get("/{vision_id}/with-goals", response_model=VisionWithGoals)
async def get_vision_with_goals(
    vision_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a vision with its associated goals."""
    vision = await vision_crud.get_vision_with_goals(db, vision_id, current_user.id)
    if vision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vision not found",
        )
    return vision


@router.put("/{vision_id}", response_model=VisionResponse)
async def update_vision(
    vision_id: uuid.UUID,
    vision_in: VisionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a vision."""
    vision = await vision_crud.get_vision(db, vision_id, current_user.id)
    if vision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vision not found",
        )
    vision = await vision_crud.update_vision(db, vision, vision_in)
    return vision


@router.delete("/{vision_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vision(
    vision_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a vision."""
    vision = await vision_crud.get_vision(db, vision_id, current_user.id)
    if vision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vision not found",
        )
    await vision_crud.delete_vision(db, vision)
