import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vision import Vision


class TestVisions:
    """Test vision endpoints."""

    @pytest.mark.asyncio
    async def test_create_vision(self, authenticated_client: AsyncClient):
        """Test creating a vision."""
        response = await authenticated_client.post(
            "/api/v1/visions",
            json={
                "title": "Become an expert",
                "description": "Master my field",
                "target_year": 2030,
                "color": "#6366f1",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Become an expert"
        assert data["description"] == "Master my field"
        assert data["target_year"] == 2030
        assert "id" in data

    @pytest.mark.asyncio
    async def test_create_vision_unauthorized(self, client: AsyncClient):
        """Test creating a vision without auth."""
        response = await client.post(
            "/api/v1/visions",
            json={"title": "Test Vision"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_visions(
        self, authenticated_client: AsyncClient, db_session: AsyncSession, test_user
    ):
        """Test listing visions."""
        # Create test visions
        vision1 = Vision(user_id=test_user.id, title="Vision 1")
        vision2 = Vision(user_id=test_user.id, title="Vision 2")
        db_session.add_all([vision1, vision2])
        await db_session.commit()

        response = await authenticated_client.get("/api/v1/visions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    @pytest.mark.asyncio
    async def test_get_vision(
        self, authenticated_client: AsyncClient, db_session: AsyncSession, test_user
    ):
        """Test getting a single vision."""
        vision = Vision(user_id=test_user.id, title="Test Vision")
        db_session.add(vision)
        await db_session.commit()
        await db_session.refresh(vision)

        response = await authenticated_client.get(f"/api/v1/visions/{vision.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Vision"

    @pytest.mark.asyncio
    async def test_get_vision_not_found(self, authenticated_client: AsyncClient):
        """Test getting a non-existent vision."""
        import uuid
        fake_id = uuid.uuid4()
        response = await authenticated_client.get(f"/api/v1/visions/{fake_id}")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_vision(
        self, authenticated_client: AsyncClient, db_session: AsyncSession, test_user
    ):
        """Test updating a vision."""
        vision = Vision(user_id=test_user.id, title="Original Title")
        db_session.add(vision)
        await db_session.commit()
        await db_session.refresh(vision)

        response = await authenticated_client.put(
            f"/api/v1/visions/{vision.id}",
            json={"title": "Updated Title"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"

    @pytest.mark.asyncio
    async def test_delete_vision(
        self, authenticated_client: AsyncClient, db_session: AsyncSession, test_user
    ):
        """Test deleting a vision."""
        vision = Vision(user_id=test_user.id, title="To Delete")
        db_session.add(vision)
        await db_session.commit()
        await db_session.refresh(vision)

        response = await authenticated_client.delete(f"/api/v1/visions/{vision.id}")
        assert response.status_code == 204

        # Verify deletion
        response = await authenticated_client.get(f"/api/v1/visions/{vision.id}")
        assert response.status_code == 404
