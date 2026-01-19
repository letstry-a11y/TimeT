import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class VisionBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    target_year: Optional[int] = None
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(None, max_length=50)
    sort_order: int = 0


class VisionCreate(VisionBase):
    pass


class VisionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    target_year: Optional[int] = None
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(None, max_length=50)
    sort_order: Optional[int] = None
    is_archived: Optional[bool] = None


class VisionResponse(VisionBase):
    id: uuid.UUID
    user_id: uuid.UUID
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VisionWithGoals(VisionResponse):
    goals: List["GoalResponse"] = []


# Forward reference for circular import
from app.schemas.goal import GoalResponse
VisionWithGoals.model_rebuild()
