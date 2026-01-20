import uuid
from datetime import datetime, date
from enum import Enum
from typing import Optional
from sqlalchemy import String, Text, DateTime, Date, ForeignKey, Integer, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.db.types import GUID


class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    goal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(), ForeignKey("goals.id", ondelete="SET NULL"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        SQLEnum(TaskStatus), nullable=False, default=TaskStatus.TODO
    )
    priority: Mapped[TaskPriority] = mapped_column(
        SQLEnum(TaskPriority), nullable=False, default=TaskPriority.MEDIUM
    )

    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="tasks")
    goal: Mapped["Goal"] = relationship("Goal", back_populates="tasks")
    time_logs: Mapped[list["TimeLog"]] = relationship(
        "TimeLog", back_populates="task", cascade="all, delete-orphan"
    )
