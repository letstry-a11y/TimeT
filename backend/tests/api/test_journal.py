import asyncio
from datetime import date, datetime
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db, make_database_engine
from app.main import app
from app.models.goal import Goal, GoalStatus, GoalType
from app.models.time_log import TimeLog, TimeLogStatus, TimeLogType
from app.models.user import User
from app.services.journal import period_window
from app.services.reviews import build_review

API = "/api/v1/journal"


async def test_two_browser_requests_cannot_capture_the_same_interval(tmp_path):
    # Each request gets its own session, as it does under uvicorn. The shared
    # db_session fixture used by single-request tests cannot exercise this race.
    engine = make_database_engine("sqlite+aiosqlite:///" + str(tmp_path / "journal.db"))
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with sessions() as db:
        user = User(email="journal@example.com", username="journal", hashed_password="unused")
        db.add(user)
        await db.commit()
        token = create_access_token(data={"sub": str(user.id)})

    async def request_session():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_db] = request_session
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test",
                               headers={"Authorization": "Bearer " + token}) as c:
            body = {"category": "rest", "start_time": "2024-02-01T12:00+08:00", "end_time": "2024-02-01T13:00+08:00"}
            replies = await asyncio.gather(*(c.put(API + "/activities/" + str(uuid4()), json=body) for _ in range(2)))
            assert sorted(response.status_code for response in replies) == [200, 409]
            assert len((await c.get(API + "/day?day=2024-02-01")).json()["entries"]) == 1
    finally:
        app.dependency_overrides.pop(get_db)
        await engine.dispose()


@pytest.fixture
async def goal(db_session, test_user):
    g = Goal(user_id=test_user.id, title="Reading", goal_type=GoalType.QUARTERLY, year=2024, quarter=1, target_hours=1)
    db_session.add(g)
    await db_session.commit()
    return g


@pytest.mark.parametrize("kind,anchor,expected", [
    ("week", date(2024, 1, 1), (date(2024, 1, 1), date(2024, 1, 8))),
    ("month", date(2024, 2, 29), (date(2024, 2, 1), date(2024, 3, 1))),
    ("quarter", date(2024, 12, 31), (date(2024, 10, 1), date(2025, 1, 1))),
    ("year", date(2024, 12, 31), (date(2024, 1, 1), date(2025, 1, 1))),
    ("five_year", date(2030, 1, 1), (date(2026, 1, 1), date(2031, 1, 1))),
])
def test_period_boundaries(kind, anchor, expected):
    assert period_window(kind, anchor) == expected


async def test_cross_midnight_overlap_plans_and_running(authenticated_client, db_session, goal, test_user):
    def log(start, end=None, planned=None):
        return TimeLog(user_id=test_user.id, goal_id=goal.id, start_time=start, end_time=end,
                       log_type=TimeLogType.PLANNED if planned else TimeLogType.MANUAL,
                       status=planned, is_running=end is None)
    # UTC 16:00 is midnight in Beijing. The two actual records overlap.
    db_session.add_all([
        log(datetime(2024, 1, 31, 15, 30), datetime(2024, 1, 31, 16, 30)),
        log(datetime(2024, 1, 31, 16), datetime(2024, 1, 31, 17), TimeLogStatus.COMPLETED),
        log(datetime(2024, 1, 31, 17), datetime(2024, 1, 31, 18), TimeLogStatus.PENDING),
        log(datetime(2024, 1, 31, 18), datetime(2024, 1, 31, 19), TimeLogStatus.NOT_COMPLETED),
        log(datetime(2024, 2, 1, 10)),
    ])
    await db_session.commit()
    r = await authenticated_client.get(API + "/day?day=2024-02-01")
    assert r.status_code == 200
    day = r.json()
    assert day["actual_minutes"] == day["goal_minutes"] == 60
    assert day["overlap_minutes"] == 30
    assert day["gaps"] == [{"start_minute": 120, "end_minute": 1080}]
    r = await authenticated_client.get(API + "/review?kind=month&anchor=2024-02-10")
    report = r.json()["report"]
    assert report["minutes"] == 60 and report["previous_minutes"] == 30
    assert report["overlap_minutes"] == 30
    assert report["plans"] == {"pending": 1, "completed": 1, "skipped": 1}
    assert sum(v["minutes"] for v in report["trend"]) == 60


async def test_daily_activity_retries_edits_overlap_and_isolation(authenticated_client, db_session, test_user):
    c = authenticated_client
    path = API + "/activities/" + str(uuid4())
    body = {"category": "rest", "start_time": "2024-02-01T12:00+08:00", "end_time": "2024-02-01T13:00+08:00"}
    assert (await c.put(path, json=body)).status_code == 200
    assert (await c.put(path, json=body)).status_code == 200
    assert (await c.put(API + "/activities/" + str(uuid4()), json=body)).status_code == 409
    assert (await c.put(path, json={**body, "end_time": "2024-02-01T12:30+08:00"})).status_code == 200
    day = (await c.get(API + "/day?day=2024-02-01")).json()
    assert len(day["entries"]) == 1 and day["life_minutes"] == 30 and day["goal_minutes"] == 0
    other = User(email="second@example.com", username="second", hashed_password="unused")
    db_session.add(other)
    await db_session.commit()
    headers = {"Authorization": "Bearer " + create_access_token(data={"sub": str(other.id)})}
    assert (await c.put(path, json=body, headers=headers)).status_code == 404
    assert (await c.delete(path, headers=headers)).status_code == 404
    assert (await c.get(API + "/day?day=2024-02-01", headers=headers)).json()["entries"] == []
    assert (await c.delete(path)).status_code == 204


async def test_saved_reviews_are_scoped_versioned_snapshots(authenticated_client, db_session, test_user):
    c = authenticated_client
    params = {"kind": "week", "anchor": "2024-02-01"}
    preview = (await c.get(API + "/review", params=params)).json()
    data = {**params, "base_version": 0, "fingerprint": preview["report"]["fingerprint"],
            "evaluated_at": preview["report"]["evaluated_at"],
            "reflection": "Reading felt easier", "next_step": "Reserve a short session"}
    saved = (await c.post(API + "/archives", json=data)).json()
    assert saved["version"] == 1 and saved["report"]["minutes"] == 0
    assert (await c.post(API + "/archives", json=data)).json()["id"] == saved["id"]
    await c.put(API + "/activities/" + str(uuid4()), json={"category": "daily",
                "start_time": "2024-02-01T10:00+08:00", "end_time": "2024-02-01T10:15+08:00"})
    assert (await c.post(API + "/archives", json={**data, "base_version": 1, "reflection": "Edited"})).status_code == 409
    current = (await c.get(API + "/review", params=params)).json()
    data.update(base_version=1, fingerprint=current["report"]["fingerprint"])
    v2 = (await c.post(API + "/archives", json=data)).json()
    assert v2["version"] == 2 and v2["report"]["minutes"] == 15
    assert (await c.get(API + "/archives/" + saved["id"])).json() == saved
    assert len((await c.get(API + "/archives?kind=week")).json()) == 2
    other = User(email="reader@example.com", username="reader", hashed_password="unused")
    db_session.add(other)
    await db_session.commit()
    headers = {"Authorization": "Bearer " + create_access_token(data={"sub": str(other.id)})}
    assert (await c.get(API + "/archives/" + saved["id"], headers=headers)).status_code == 404
    assert (await c.get(API + "/archives", headers=headers)).json() == []


async def test_equal_elapsed_comparison(db_session, test_user, goal):
    for d in (1, 3, 4):
        db_session.add(TimeLog(user_id=test_user.id, goal_id=goal.id, log_type=TimeLogType.MANUAL,
                               start_time=datetime(2024, 1, d, 1), end_time=datetime(2024, 1, d, 2)))
    await db_session.commit()
    result = await build_review(db_session, test_user.id, "month", date(2024, 2, 2), datetime(2024, 2, 2, 2))
    assert result["partial"] and result["previous_minutes"] == 60
    assert result["previous_end"] == "2024-01-02"


async def test_one_reward_after_explicit_completion(authenticated_client, db_session, goal):
    c = authenticated_client
    path = API + "/rewards/" + str(goal.id)
    goal.accumulated_hours = goal.target_hours
    await db_session.commit()
    data = {"reward": "An afternoon in a bookshop", "outcome": "Finished the reading notes"}
    assert (await c.put(path, json=data)).status_code == 409
    goal.status = GoalStatus.COMPLETED
    await db_session.commit()
    reward = (await c.put(path, json=data)).json()
    assert reward["outcome"] == data["outcome"]
    assert (await c.put(path, json=data)).json() == reward
    assert (await c.get(API + "/rewards?year=2024")).json() == [reward]
