import uuid
from datetime import datetime, date
from enum import Enum
from sqlalchemy import String, Text, DateTime, Date, ForeignKey, Integer, Numeric, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class GoalType(str, Enum):
    YEARLY = "yearly"
    QUARTERLY = "quarterly"


class GoalStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    vision_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("visions.id", ondelete="SET NULL"), nullable=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goals.id", ondelete="CASCADE"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    goal_type: Mapped[GoalType] = mapped_column(
        SQLEnum(GoalType), nullable=False, default=GoalType.QUARTERLY
    )
    status: Mapped[GoalStatus] = mapped_column(
        SQLEnum(GoalStatus), nullable=False, default=GoalStatus.NOT_STARTED
    )

    # Time frame
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    quarter: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-4 for quarterly goals
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Target and progress
    target_hours: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    accumulated_hours: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    progress_percentage: Mapped[float] = mapped_column(Numeric(5, 2), default=0)

    # UI
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[bool] = mapped_column(default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="goals")
    vision: Mapped["Vision"] = relationship("Vision", back_populates="goals")
    parent: Mapped["Goal"] = relationship(
        "Goal", remote_side=[id], back_populates="children"
    )
    children: Mapped[list["Goal"]] = relationship(
        "Goal", back_populates="parent", cascade="all, delete-orphan"
    )
    tasks: Mapped[list["Task"]] = relationship(
        "Task", back_populates="goal", cascade="all, delete-orphan"
    )
    time_logs: Mapped[list["TimeLog"]] = relationship(
        "TimeLog", back_populates="goal", cascade="all, delete-orphan"
    )
