import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.db.types import GUID


class Vision(Base):
    __tablename__ = "visions"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)  # Hex color
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Icon name
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="visions")
    goals: Mapped[list["Goal"]] = relationship(
        "Goal", back_populates="vision", cascade="all, delete-orphan"
    )
