from datetime import date, datetime, timedelta
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints, model_validator
from app.crud.timelog import to_naive_utc

Period = Literal["week", "month", "quarter", "year", "five_year"]
LifeCategory = Literal["rest", "travel", "daily", "other"]
Anchor = Annotated[date, Field(ge=date(1900, 1, 1), le=date(2200, 12, 31))]


class Availability(BaseModel):
    start_minute: int = Field(strict=True, ge=0, lt=1440)


class ActivityInput(BaseModel):
    category: LifeCategory
    start_time: datetime
    end_time: datetime
    note: str = Field("", max_length=2000)

    @model_validator(mode="after")
    def validate_interval(self):
        self.start_time = to_naive_utc(self.start_time)
        self.end_time = to_naive_utc(self.end_time)
        if self.end_time <= self.start_time:
            raise ValueError("End time must follow start time")
        if self.end_time > datetime.utcnow() + timedelta(seconds=2):
            raise ValueError("Completed activities must end in the past")
        return self


class RewardInput(BaseModel):
    reward: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
    outcome: str = Field("", max_length=4000)


class ArchiveInput(BaseModel):
    kind: Period
    anchor: Anchor
    reflection: str = Field("", max_length=12000)
    next_step: str = Field("", max_length=3000)
    base_version: int = Field(ge=0)
    fingerprint: str = Field(pattern=r"^[a-f0-9]{64}$")
    evaluated_at: datetime
