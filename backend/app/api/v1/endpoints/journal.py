from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.crud.goal import get_goal
from app.crud.timelog import to_naive_utc
from app.db.session import get_db
from app.models.goal import Goal, GoalStatus
from app.models.journal import DailyActivity, GoalReward, JournalAvailability, ReviewSnapshot
from app.models.user import User
from app.schemas.journal import ActivityInput, Anchor, ArchiveInput, Availability, Period, RewardInput
from app.services.journal import (
    DAY, assert_free_interval, availability_start, day_summary, entries_between,
    local_day, lock_journal_user, midnight_utc, period_window,
)
from app.services.reviews import build_review, focus_options

router = APIRouter()


@router.get("/availability", response_model=Availability)
async def get_availability(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    return Availability(start_minute=await availability_start(db, user.id))


@router.put("/availability", response_model=Availability)
async def set_availability(body: Availability, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await lock_journal_user(db, user.id)
    await db.merge(JournalAvailability(user_id=user.id, start_minute=body.start_minute))
    await db.commit()
    return body


@router.get("/day")
async def get_day(day: Anchor, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.utcnow()
    start = midnight_utc(day)
    entries = await entries_between(db, user.id, start, start + DAY)
    summary = day_summary(entries, day, now, await availability_start(db, user.id))
    summary["goals"] = await focus_options(db, user.id, day, now)
    return summary


@router.put("/activities/{activity_id}")
async def put_activity(activity_id: UUID, body: ActivityInput, db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_user)):
    # Client-generated IDs allow safe retries of a capture after a lost response.
    row = await db.get(DailyActivity, activity_id)
    if row and row.user_id != user.id:
        raise HTTPException(404, "Activity not found")
    if row and all(getattr(row, k) == v for k, v in body.model_dump().items()):
        return {"id": row.id}
    await assert_free_interval(db, user.id, body.start_time, body.end_time, activity_id)
    if row is None:
        row = DailyActivity(id=activity_id, user_id=user.id)
        db.add(row)
    for key, value in body.model_dump().items():
        setattr(row, key, value)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Please reload this day to see the saved entry") from None
    return {"id": activity_id}


@router.delete("/activities/{activity_id}", status_code=204)
async def delete_activity(activity_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    row = await db.scalar(select(DailyActivity).where(DailyActivity.id == activity_id, DailyActivity.user_id == user.id))
    if row is None:
        raise HTTPException(404, "Activity not found")
    await db.delete(row)
    await db.commit()
    return Response(status_code=204)


def reward_view(row, title):
    return {"goal_id": row.goal_id, "title": title, "reward": row.reward,
            "outcome": row.outcome, "day": local_day(row.created_at)}


@router.get("/rewards")
async def get_rewards(year: int | None = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(GoalReward, Goal.title).join(Goal, Goal.id == GoalReward.goal_id).where(
        GoalReward.user_id == user.id, Goal.user_id == user.id)
    if year is not None:
        stmt = stmt.where(Goal.year == year)
    rows = await db.execute(stmt.order_by(GoalReward.created_at.desc(), GoalReward.goal_id))
    return [reward_view(reward, title) for reward, title in rows]


@router.put("/rewards/{goal_id}")
async def claim_reward(goal_id: UUID, body: RewardInput, db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_user)):
    goal = await get_goal(db, goal_id, user.id)
    if goal is None:
        raise HTTPException(404, "Goal not found")
    existing = await db.get(GoalReward, goal_id)
    if existing:
        return reward_view(existing, goal.title)
    if goal.status != GoalStatus.COMPLETED:
        raise HTTPException(409, "Confirm completion of this goal first")
    title = goal.title
    reward = GoalReward(goal_id=goal_id, user_id=user.id, **body.model_dump())
    db.add(reward)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        reward = await db.get(GoalReward, goal_id)
        if reward is None:
            raise HTTPException(409, "Goal changed, reload and try again") from None
    return reward_view(reward, title)


def archive_header(row):
    return {"id": row.id, "kind": row.kind, "start": row.period_start, "version": row.version,
            "created_at": row.created_at}


def archive_view(row):
    return {**archive_header(row), "report": row.snapshot,
            "reflection": row.reflection, "next_step": row.next_step}


async def latest_version(db, user_id, kind, start):
    return await db.scalar(select(ReviewSnapshot).where(
        ReviewSnapshot.user_id == user_id, ReviewSnapshot.kind == kind,
        ReviewSnapshot.period_start == start).order_by(ReviewSnapshot.version.desc()).limit(1))


@router.get("/review")
async def preview(kind: Period, anchor: Anchor, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    report = await build_review(db, user.id, kind, anchor)
    start, _ = period_window(kind, anchor)
    latest = await latest_version(db, user.id, kind, start)
    return {"report": report, "latest": archive_view(latest) if latest else None}


@router.get("/archives")
async def list_archives(kind: Period | None = None, skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
                        db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(ReviewSnapshot.id, ReviewSnapshot.kind, ReviewSnapshot.period_start,
                  ReviewSnapshot.version, ReviewSnapshot.created_at).where(ReviewSnapshot.user_id == user.id)
    if kind:
        stmt = stmt.where(ReviewSnapshot.kind == kind)
    rows = await db.execute(stmt.order_by(ReviewSnapshot.period_start.desc(), ReviewSnapshot.created_at.desc(),
                                          ReviewSnapshot.id).offset(skip).limit(limit))
    return [archive_header(row) for row in rows]


@router.get("/archives/{archive_id}")
async def read_archive(archive_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    row = await db.scalar(select(ReviewSnapshot).where(ReviewSnapshot.user_id == user.id, ReviewSnapshot.id == archive_id))
    if row is None:
        raise HTTPException(404, "Review not found")
    return archive_view(row)


@router.post("/archives")
async def save_archive(body: ArchiveInput, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    start, _ = period_window(body.kind, body.anchor)
    latest = await latest_version(db, user.id, body.kind, start)
    if latest and (latest.snapshot["fingerprint"], latest.reflection, latest.next_step) == (
        body.fingerprint, body.reflection, body.next_step
    ):
        return archive_view(latest)
    if (latest.version if latest else 0) != body.base_version:
        raise HTTPException(409, "A newer version exists. Refresh before saving.")
    cutoff = to_naive_utc(body.evaluated_at)
    if cutoff > datetime.utcnow():
        raise HTTPException(422, "The preview time is in the future")
    # Use the same instant for both reads. In a partial period even an unchanged
    # previous-period interval can gain minutes between opening and saving.
    report = await build_review(db, user.id, body.kind, body.anchor, now=cutoff)
    if report["fingerprint"] != body.fingerprint:
        raise HTTPException(409, "The underlying records changed. Refresh before saving.")
    row = ReviewSnapshot(user_id=user.id, kind=body.kind, period_start=start, version=body.base_version + 1,
                         snapshot=report, reflection=body.reflection, next_step=body.next_step)
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "A newer version exists. Refresh before saving.") from None
    return archive_view(row)
