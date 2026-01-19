from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel


class VisionAlignmentItem(BaseModel):
    vision_id: str
    vision_title: str
    hours: float
    percentage: float


class VisionAlignmentReport(BaseModel):
    report_type: str = "vision_alignment"
    generated_at: datetime
    total_hours: float
    data: List[VisionAlignmentItem]


class GoalProgressItem(BaseModel):
    goal_id: str
    title: str
    goal_type: str
    status: str
    target_hours: Optional[float]
    accumulated_hours: float
    progress_percentage: float
    quarter: Optional[int]


class GoalProgressReport(BaseModel):
    report_type: str = "goal_progress"
    generated_at: datetime
    year: int
    quarter: Optional[int]
    data: List[GoalProgressItem]


class DailyStats(BaseModel):
    date: date
    hours: float
    log_count: int


class WeeklyReport(BaseModel):
    start_date: date
    end_date: date
    total_hours: float
    daily_breakdown: List[DailyStats]
    top_goals: List[dict]
