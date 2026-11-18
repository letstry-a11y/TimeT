import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import GUID


class DailyActivity(Base):
    """Time outside quarterly goals, such as rest or commuting."""
    __tablename__ = "daily_activities"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(20))
    note: Mapped[str] = mapped_column(Text, default="")
    start_time: Mapped[datetime] = mapped_column(DateTime, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime)


class GoalReward(Base):
    __tablename__ = "goal_rewards"

    goal_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("goals.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    reward: Mapped[str] = mapped_column(String(160))
    outcome: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ReviewSnapshot(Base):
    __tablename__ = "review_snapshots"
    __table_args__ = (UniqueConstraint("user_id", "kind", "period_start", "version"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(16))
    period_start: Mapped[date] = mapped_column(Date)
    version: Mapped[int]
    snapshot: Mapped[dict] = mapped_column(JSON)
    reflection: Mapped[str] = mapped_column(Text)
    next_step: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
