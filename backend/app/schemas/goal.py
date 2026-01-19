import uuid
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field, model_validator
from app.models.goal import GoalType, GoalStatus


class GoalBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    goal_type: GoalType = GoalType.QUARTERLY
    status: GoalStatus = GoalStatus.NOT_STARTED
    year: int
    quarter: Optional[int] = Field(None, ge=1, le=4)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    target_hours: Optional[float] = Field(None, ge=0)
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    sort_order: int = 0

    @model_validator(mode="after")
    def validate_quarterly_goal(self):
        if self.goal_type == GoalType.QUARTERLY and self.quarter is None:
            raise ValueError("Quarter is required for quarterly goals")
        return self


class GoalCreate(GoalBase):
    vision_id: Optional[uuid.UUID] = None
    parent_id: Optional[uuid.UUID] = None


class GoalUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    goal_type: Optional[GoalType] = None
    status: Optional[GoalStatus] = None
    year: Optional[int] = None
    quarter: Optional[int] = Field(None, ge=1, le=4)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    target_hours: Optional[float] = Field(None, ge=0)
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    sort_order: Optional[int] = None
    is_archived: Optional[bool] = None
    vision_id: Optional[uuid.UUID] = None
    parent_id: Optional[uuid.UUID] = None


class GoalResponse(GoalBase):
    id: uuid.UUID
    user_id: uuid.UUID
    vision_id: Optional[uuid.UUID]
    parent_id: Optional[uuid.UUID]
    accumulated_hours: float
    progress_percentage: float
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GoalWithChildren(GoalResponse):
    children: List["GoalWithChildren"] = []


class GoalTree(GoalResponse):
    children: List["GoalTree"] = []
    vision_title: Optional[str] = None


GoalWithChildren.model_rebuild()
GoalTree.model_rebuild()
