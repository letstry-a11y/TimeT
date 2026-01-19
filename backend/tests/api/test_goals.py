import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vision import Vision
from app.models.goal import Goal, GoalType, GoalStatus


class TestGoals:
    """Test goal endpoints."""

    @pytest.fixture
    async def test_vision(self, db_session: AsyncSession, test_user) -> Vision:
        """Create a test vision."""
        vision = Vision(user_id=test_user.id, title="Test Vision")
        db_session.add(vision)
        await db_session.commit()
        await db_session.refresh(vision)
        return vision

    @pytest.fixture
    async def test_yearly_goal(
        self, db_session: AsyncSession, test_user, test_vision
    ) -> Goal:
        """Create a test yearly goal."""
        goal = Goal(
            user_id=test_user.id,
            vision_id=test_vision.id,
            title="Yearly Goal",
            goal_type=GoalType.YEARLY,
            year=2024,
        )
        db_session.add(goal)
        await db_session.commit()
        await db_session.refresh(goal)
        return goal

    @pytest.mark.asyncio
    async def test_create_yearly_goal(
        self, authenticated_client: AsyncClient, test_vision
    ):
        """Test creating a yearly goal."""
        response = await authenticated_client.post(
            "/api/v1/goals",
            json={
                "title": "Learn Python",
                "goal_type": "yearly",
                "year": 2024,
                "vision_id": str(test_vision.id),
                "target_hours": 500,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Learn Python"
        assert data["goal_type"] == "yearly"
        assert data["target_hours"] == 500

    @pytest.mark.asyncio
    async def test_create_yearly_goal_without_vision(
        self, authenticated_client: AsyncClient
    ):
        """Test that yearly goal requires a vision."""
        response = await authenticated_client.post(
            "/api/v1/goals",
            json={
                "title": "Invalid Goal",
                "goal_type": "yearly",
                "year": 2024,
            },
        )
        assert response.status_code == 400
        assert "must be linked to a vision" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_create_quarterly_goal(
        self, authenticated_client: AsyncClient, test_yearly_goal
    ):
        """Test creating a quarterly goal."""
        response = await authenticated_client.post(
            "/api/v1/goals",
            json={
                "title": "Q1 Python Basics",
                "goal_type": "quarterly",
                "year": 2024,
                "quarter": 1,
                "parent_id": str(test_yearly_goal.id),
                "target_hours": 100,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Q1 Python Basics"
        assert data["goal_type"] == "quarterly"
        assert data["quarter"] == 1
        assert data["parent_id"] == str(test_yearly_goal.id)

    @pytest.mark.asyncio
    async def test_create_quarterly_goal_without_parent(
        self, authenticated_client: AsyncClient
    ):
        """Test that quarterly goal requires a parent."""
        response = await authenticated_client.post(
            "/api/v1/goals",
            json={
                "title": "Invalid Quarterly",
                "goal_type": "quarterly",
                "year": 2024,
                "quarter": 1,
            },
        )
        assert response.status_code == 400
        assert "must be linked to a yearly goal" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_list_goals(
        self, authenticated_client: AsyncClient, test_yearly_goal
    ):
        """Test listing goals."""
        response = await authenticated_client.get("/api/v1/goals")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    @pytest.mark.asyncio
    async def test_list_goals_filter_by_year(
        self, authenticated_client: AsyncClient, test_yearly_goal
    ):
        """Test filtering goals by year."""
        response = await authenticated_client.get("/api/v1/goals?year=2024")
        assert response.status_code == 200
        data = response.json()
        assert all(g["year"] == 2024 for g in data)

    @pytest.mark.asyncio
    async def test_list_goals_filter_by_type(
        self, authenticated_client: AsyncClient, test_yearly_goal
    ):
        """Test filtering goals by type."""
        response = await authenticated_client.get("/api/v1/goals?goal_type=yearly")
        assert response.status_code == 200
        data = response.json()
        assert all(g["goal_type"] == "yearly" for g in data)

    @pytest.mark.asyncio
    async def test_get_goal(self, authenticated_client: AsyncClient, test_yearly_goal):
        """Test getting a single goal."""
        response = await authenticated_client.get(f"/api/v1/goals/{test_yearly_goal.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Yearly Goal"

    @pytest.mark.asyncio
    async def test_update_goal_status(
        self, authenticated_client: AsyncClient, test_yearly_goal
    ):
        """Test updating goal status."""
        response = await authenticated_client.put(
            f"/api/v1/goals/{test_yearly_goal.id}",
            json={"status": "in_progress"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"

    @pytest.mark.asyncio
    async def test_delete_goal(
        self, authenticated_client: AsyncClient, test_yearly_goal
    ):
        """Test deleting a goal."""
        response = await authenticated_client.delete(
            f"/api/v1/goals/{test_yearly_goal.id}"
        )
        assert response.status_code == 204
