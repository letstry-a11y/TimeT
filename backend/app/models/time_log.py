import uuid
from datetime import datetime
from enum import Enum
from typing import Optional
from sqlalchemy import String, Text, DateTime, ForeignKey, Numeric, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.db.types import GUID


class TimeLogType(str, Enum):
    CLOCK_IN = "clock_in"  # Real-time clock in/out
    MANUAL = "manual"      # Manual entry


class TimeLog(Base):
    __tablename__ = "time_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    goal_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False
    )
    task_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True
    )

    log_type: Mapped[TimeLogType] = mapped_column(
        SQLEnum(TimeLogType), nullable=False, default=TimeLogType.CLOCK_IN
    )

    # Time tracking
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    duration_minutes: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)

    # Content
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Comma-separated

    # Tracking state
    is_running: Mapped[bool] = mapped_column(default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="time_logs")
    goal: Mapped["Goal"] = relationship("Goal", back_populates="time_logs")
    task: Mapped["Task"] = relationship("Task", back_populates="time_logs")
