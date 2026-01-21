import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, model_validator
from app.models.time_log import TimeLogType, TimeLogStatus


class TimeLogBase(BaseModel):
    goal_id: uuid.UUID
    task_id: Optional[uuid.UUID] = None
    note: Optional[str] = None
    tags: Optional[str] = None


class TimeLogStart(TimeLogBase):
    """Schema for starting a clock-in session."""
    pass


class TimeLogManual(TimeLogBase):
    """Schema for manual time entry."""
    start_time: datetime
    end_time: datetime
    duration_minutes: Optional[float] = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("End time must be after start time")
        # Auto-calculate duration if not provided
        if self.duration_minutes is None:
            delta = self.end_time - self.start_time
            self.duration_minutes = delta.total_seconds() / 60
        return self


class TimeLogPlanned(TimeLogBase):
    """Schema for creating a planned task."""
    start_time: datetime
    end_time: datetime
    duration_minutes: Optional[float] = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("End time must be after start time")
        # Auto-calculate duration if not provided
        if self.duration_minutes is None:
            delta = self.end_time - self.start_time
            self.duration_minutes = delta.total_seconds() / 60
        return self


class TimeLogStatusUpdate(BaseModel):
    """Schema for updating planned task status."""
    status: TimeLogStatus


class TimeLogStop(BaseModel):
    """Schema for stopping a clock-in session."""
    note: Optional[str] = None


class TimeLogUpdate(BaseModel):
    goal_id: Optional[uuid.UUID] = None
    task_id: Optional[uuid.UUID] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: Optional[float] = None
    note: Optional[str] = None
    tags: Optional[str] = None


class TimeLogResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    goal_id: uuid.UUID
    task_id: Optional[uuid.UUID]
    log_type: TimeLogType
    status: Optional[TimeLogStatus]
    start_time: datetime
    end_time: Optional[datetime]
    duration_minutes: Optional[float]
    note: Optional[str]
    tags: Optional[str]
    is_running: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TimeLogWithDetails(TimeLogResponse):
    goal_title: Optional[str] = None
    task_title: Optional[str] = None


class TimeLogStats(BaseModel):
    total_minutes: float
    total_hours: float
    log_count: int
    by_goal: List[dict] = []
    by_date: List[dict] = []
