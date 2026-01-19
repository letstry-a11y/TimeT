import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vision import Vision
from app.models.goal import Goal, GoalType
from app.models.time_log import TimeLog, TimeLogType


class TestTimelogs:
    """Test timelog endpoints."""

    @pytest.fixture
    async def test_quarterly_goal(
        self, db_session: AsyncSession, test_user
    ) -> Goal:
        """Create a test quarterly goal (time can only be logged to quarterly goals)."""
        vision = Vision(user_id=test_user.id, title="Test Vision")
        db_session.add(vision)
        await db_session.commit()

        yearly = Goal(
            user_id=test_user.id,
            vision_id=vision.id,
            title="Yearly Goal",
            goal_type=GoalType.YEARLY,
            year=2024,
        )
        db_session.add(yearly)
        await db_session.commit()

        quarterly = Goal(
            user_id=test_user.id,
            parent_id=yearly.id,
            title="Quarterly Goal",
            goal_type=GoalType.QUARTERLY,
            year=2024,
            quarter=1,
        )
        db_session.add(quarterly)
        await db_session.commit()
        await db_session.refresh(quarterly)
        return quarterly

    @pytest.mark.asyncio
    async def test_start_clock_in(
        self, authenticated_client: AsyncClient, test_quarterly_goal
    ):
        """Test starting a clock-in session."""
        response = await authenticated_client.post(
            "/api/v1/timelogs/start",
            json={
                "goal_id": str(test_quarterly_goal.id),
                "note": "Working on tests",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["goal_id"] == str(test_quarterly_goal.id)
        assert data["is_running"] is True
        assert data["log_type"] == "clock_in"

    @pytest.mark.asyncio
    async def test_start_clock_in_prevents_duplicate(
        self, authenticated_client: AsyncClient, test_quarterly_goal, db_session, test_user
    ):
        """Test that starting another session while one is running fails."""
        # Create a running session
        running_log = TimeLog(
            user_id=test_user.id,
            goal_id=test_quarterly_goal.id,
            log_type=TimeLogType.CLOCK_IN,
            start_time=datetime.utcnow(),
            is_running=True,
        )
        db_session.add(running_log)
        await db_session.commit()

        # Try to start another
        response = await authenticated_client.post(
            "/api/v1/timelogs/start",
            json={"goal_id": str(test_quarterly_goal.id)},
        )
        assert response.status_code == 409
        assert "already have an active" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_stop_clock_in(
        self, authenticated_client: AsyncClient, test_quarterly_goal, db_session, test_user
    ):
        """Test stopping a clock-in session."""
        # Create a running session
        running_log = TimeLog(
            user_id=test_user.id,
            goal_id=test_quarterly_goal.id,
            log_type=TimeLogType.CLOCK_IN,
            start_time=datetime.utcnow() - timedelta(hours=1),
            is_running=True,
        )
        db_session.add(running_log)
        await db_session.commit()
        await db_session.refresh(running_log)

        response = await authenticated_client.patch(
            f"/api/v1/timelogs/{running_log.id}/stop",
            json={"note": "Finished working"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_running"] is False
        assert data["end_time"] is not None
        assert data["duration_minutes"] > 0

    @pytest.mark.asyncio
    async def test_create_manual_entry(
        self, authenticated_client: AsyncClient, test_quarterly_goal
    ):
        """Test creating a manual time entry."""
        start = datetime.utcnow() - timedelta(hours=2)
        end = datetime.utcnow() - timedelta(hours=1)

        response = await authenticated_client.post(
            "/api/v1/timelogs",
            json={
                "goal_id": str(test_quarterly_goal.id),
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "note": "Manual entry",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["log_type"] == "manual"
        assert data["is_running"] is False
        assert data["duration_minutes"] == pytest.approx(60, rel=1)

    @pytest.mark.asyncio
    async def test_create_manual_entry_invalid_times(
        self, authenticated_client: AsyncClient, test_quarterly_goal
    ):
        """Test that end_time must be after start_time."""
        start = datetime.utcnow()
        end = datetime.utcnow() - timedelta(hours=1)

        response = await authenticated_client.post(
            "/api/v1/timelogs",
            json={
                "goal_id": str(test_quarterly_goal.id),
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_timelogs(
        self, authenticated_client: AsyncClient, test_quarterly_goal, db_session, test_user
    ):
        """Test listing time logs."""
        # Create test logs
        log1 = TimeLog(
            user_id=test_user.id,
            goal_id=test_quarterly_goal.id,
            log_type=TimeLogType.MANUAL,
            start_time=datetime.utcnow() - timedelta(hours=2),
            end_time=datetime.utcnow() - timedelta(hours=1),
            duration_minutes=60,
            is_running=False,
        )
        log2 = TimeLog(
            user_id=test_user.id,
            goal_id=test_quarterly_goal.id,
            log_type=TimeLogType.MANUAL,
            start_time=datetime.utcnow() - timedelta(hours=4),
            end_time=datetime.utcnow() - timedelta(hours=3),
            duration_minutes=60,
            is_running=False,
        )
        db_session.add_all([log1, log2])
        await db_session.commit()

        response = await authenticated_client.get("/api/v1/timelogs")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    @pytest.mark.asyncio
    async def test_get_current_session(
        self, authenticated_client: AsyncClient, test_quarterly_goal, db_session, test_user
    ):
        """Test getting the current running session."""
        # No running session
        response = await authenticated_client.get("/api/v1/timelogs/current")
        assert response.status_code == 200
        assert response.json() is None

        # Create running session
        running_log = TimeLog(
            user_id=test_user.id,
            goal_id=test_quarterly_goal.id,
            log_type=TimeLogType.CLOCK_IN,
            start_time=datetime.utcnow(),
            is_running=True,
        )
        db_session.add(running_log)
        await db_session.commit()

        response = await authenticated_client.get("/api/v1/timelogs/current")
        assert response.status_code == 200
        data = response.json()
        assert data["is_running"] is True

    @pytest.mark.asyncio
    async def test_delete_timelog(
        self, authenticated_client: AsyncClient, test_quarterly_goal, db_session, test_user
    ):
        """Test deleting a time log."""
        log = TimeLog(
            user_id=test_user.id,
            goal_id=test_quarterly_goal.id,
            log_type=TimeLogType.MANUAL,
            start_time=datetime.utcnow() - timedelta(hours=2),
            end_time=datetime.utcnow() - timedelta(hours=1),
            duration_minutes=60,
            is_running=False,
        )
        db_session.add(log)
        await db_session.commit()
        await db_session.refresh(log)

        response = await authenticated_client.delete(f"/api/v1/timelogs/{log.id}")
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_cannot_log_to_yearly_goal(
        self, authenticated_client: AsyncClient, db_session, test_user
    ):
        """Test that time cannot be logged to yearly goals."""
        vision = Vision(user_id=test_user.id, title="Test Vision")
        db_session.add(vision)
        await db_session.commit()

        yearly = Goal(
            user_id=test_user.id,
            vision_id=vision.id,
            title="Yearly Goal",
            goal_type=GoalType.YEARLY,
            year=2024,
        )
        db_session.add(yearly)
        await db_session.commit()
        await db_session.refresh(yearly)

        response = await authenticated_client.post(
            "/api/v1/timelogs/start",
            json={"goal_id": str(yearly.id)},
        )
        assert response.status_code == 400
        assert "quarterly goals" in response.json()["detail"]
