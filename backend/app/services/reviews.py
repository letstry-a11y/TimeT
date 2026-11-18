"""Compute a review from raw intervals, independently of any saved reviews."""
import hashlib
import json
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select

from app.models.goal import Goal, GoalStatus, GoalType
from app.models.journal import GoalReward
from app.services.journal import DAY, actual_intervals, entries_between, local_day, midnight_utc, minutes, overlap_minutes, period_window, union


def daily_minutes(intervals):
    totals = defaultdict(float)
    for left, end in union(intervals):
        while left < end:
            day = local_day(left)
            right = min(end, midnight_utc(day + DAY))
            totals[day] += (right - left).total_seconds() / 60
            left = right
    return totals


def trend(kind, start, end, days):
    def bucket(day):
        if kind == "five_year":
            return date(day.year, 1, 1)
        if kind in ("year", "quarter"):
            return day.replace(day=1)
        return day

    values = {}
    for offset in range((end - start).days):
        day = start + offset * DAY
        key = bucket(day)
        values[key] = values.get(key, 0) + days.get(day, 0)
    return [{"date": key, "minutes": round(value, 2)} for key, value in values.items()]


async def quarter_goals(db, user_id, start, end):
    rows = await db.scalars(select(Goal).where(
        Goal.user_id == user_id, Goal.goal_type == GoalType.QUARTERLY,
        Goal.year.between(start.year, (end - DAY).year)
    ).order_by(Goal.sort_order, Goal.title, Goal.id))
    first = start.year * 4 + (start.month - 1) // 3
    last_day = end - DAY
    last = last_day.year * 4 + (last_day.month - 1) // 3
    return [g for g in rows if g.quarter and first <= g.year * 4 + g.quarter - 1 <= last]


async def focus_options(db, user_id, day, now):
    """Suggest one small next session using quarter pace and the last seven days."""
    start, end = period_window("quarter", day)
    recent_start = midnight_utc(day - 6 * DAY)
    recent_end = min(midnight_utc(day + DAY), now)
    entries = await entries_between(db, user_id, recent_start, recent_end)
    intervals = defaultdict(list)
    for entry, left, right in actual_intervals(entries, recent_start, recent_end):
        intervals[entry.goal_id].append((left, right))
    goals = await quarter_goals(db, user_id, start, end)
    options = []
    for goal in goals:
        if goal.is_archived or goal.status not in (GoalStatus.IN_PROGRESS, GoalStatus.NOT_STARTED):
            continue
        if (goal.start_date and goal.start_date > day) or (goal.end_date and goal.end_date < day):
            continue
        recent = intervals[goal.id]
        options.append({
            "id": str(goal.id), "title": goal.title,
            "logged_hours": float(goal.accumulated_hours), "target_hours": float(goal.target_hours or 0),
            "recent_minutes": minutes(recent), "recent_days": len(daily_minutes(recent)),
        })
    pace = ((day - start).days + 1) / (end - start).days
    def priority(item):
        target = item["target_hours"]
        progress = item["logged_hours"] / target if target else None
        weekly_minutes = target * 60 * 7 / (end - start).days
        recent_share = min(1, item["recent_minutes"] / weekly_minutes) if weekly_minutes else 0
        return (progress is not None and progress >= 1,
                progress - pace + recent_share * 0.15 if progress is not None else 0,
                item["recent_days"], item["recent_minutes"])
    return sorted(options, key=priority)


async def build_review(db, user_id, kind, anchor, now=None):
    now = now or datetime.utcnow()
    today = local_day(now)
    start, end = period_window(kind, anchor)
    if start > today:
        raise HTTPException(422, "The selected period has not started")
    lower, upper = midnight_utc(start), min(midnight_utc(end), now)
    previous_start, _ = period_window(kind, start - DAY)
    prior_lower = midnight_utc(previous_start)
    prior_upper = lower if end <= today else min(lower, prior_lower + (upper - lower))
    entries = await entries_between(db, user_id, lower, upper)
    previous = await entries_between(db, user_id, prior_lower, prior_upper)
    prior_total = minutes((a, b) for _, a, b in actual_intervals(previous, prior_lower, prior_upper))
    actual = list(actual_intervals(entries, lower, upper))
    daily = daily_minutes((a, b) for _, a, b in actual)
    grouped = defaultdict(list)
    labels = {}
    for e, a, b in actual:
        key = str(e.goal_id) if e.goal_id else e.category
        grouped[key].append((a, b))
        labels[key] = (e.title, e.category)
    totals = {key: minutes(intervals) for key, intervals in grouped.items()}
    split = sorted([{"key": key, "title": title, "category": cat, "minutes": totals[key]}
                    for key, (title, cat) in labels.items()], key=lambda r: (-r["minutes"], r["key"]))
    plans = [e for e in entries if e.is_plan and lower <= e.start_time < upper]
    goals = await quarter_goals(db, user_id, start, end)
    goal_rows = [{"id": str(g.id), "title": g.title, "year": g.year, "quarter": g.quarter,
                  "status": g.status.value, "target_hours": float(g.target_hours or 0),
                  "period_minutes": totals.get(str(g.id), 0), "archived": g.is_archived}
                 for g in goals]
    reward_rows = await db.execute(select(GoalReward, Goal.title).join(
        Goal, Goal.id == GoalReward.goal_id).where(
        GoalReward.user_id == user_id, Goal.user_id == user_id, GoalReward.created_at >= lower,
        GoalReward.created_at < upper).order_by(GoalReward.created_at, GoalReward.goal_id))
    awards = [{"title": title, "reward": row.reward, "outcome": row.outcome,
               "day": local_day(row.created_at)} for row, title in reward_rows]

    covered = round(sum(daily.values()), 2)
    data = {
        "kind": kind, "start": start, "end": end - DAY, "as_of": min(end - DAY, today),
        "previous_start": previous_start, "previous_end": local_day(max(prior_lower, prior_upper - timedelta(microseconds=1))),
        "partial": end > today, "minutes": covered, "previous_minutes": prior_total,
        "overlap_minutes": overlap_minutes(actual, covered),
        "days": len(daily), "entries": len(actual),
        "goal_minutes": minutes((a, b) for e, a, b in actual if e.goal_id),
        "life_minutes": minutes((a, b) for e, a, b in actual if not e.goal_id),
        "plans": {"pending": sum(e.state == "planned" for e in plans), "completed": sum(e.state == "actual" for e in plans),
                  "skipped": sum(e.state == "skipped" for e in plans)},
        "trend": trend(kind, start, end, daily), "distribution": split,
        "goals": goal_rows, "rewards": awards,
    }
    # Include the actual inputs to each suggestion in the snapshot. Clients can
    # render both languages from the same immutable, explainable facts.
    steps = []
    if not actual:
        steps.append({"kind": "first_entry"})
    if data["plans"]["pending"]:
        steps.append({"kind": "confirm_plan", "count": data["plans"]["pending"]})
    if actual:
        cutoff_day = min(end - DAY, today)
        active = [g for g in goal_rows if not g["archived"] and g["status"] in ("not_started", "in_progress")
                  and (g["year"], g["quarter"]) == (cutoff_day.year, (cutoff_day.month - 1) // 3 + 1)
                  and g["target_hours"] and g["period_minutes"] == 0]
        if active:
            steps.append({"kind": "small_session", "title": active[0]["title"]})
        if split:
            steps.append({"kind": "repeat_or_adjust", "title": split[0]["title"], "category": split[0]["category"],
                          "minutes": split[0]["minutes"]})
    data["steps"] = steps[:3]
    payload = jsonable_encoder(data)
    serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    payload["fingerprint"] = hashlib.sha256(serialized.encode()).hexdigest()
    payload["evaluated_at"] = now.replace(tzinfo=timezone.utc).isoformat()
    return payload
