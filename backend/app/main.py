from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router
from app.db.session import init_db, AsyncSessionLocal


async def fix_inconsistent_goal_statuses():
    """Fix goals that have accumulated hours but status is still not_started."""
    from sqlalchemy import select, update
    from app.models.goal import Goal, GoalStatus

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            update(Goal)
            .where(Goal.accumulated_hours > 0, Goal.status == GoalStatus.NOT_STARTED)
            .values(status=GoalStatus.IN_PROGRESS)
        )
        if result.rowcount > 0:
            await session.commit()
            print(f"Fixed {result.rowcount} goal(s) with inconsistent status.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database tables
    await init_db()
    # Fix any inconsistent goal statuses
    await fix_inconsistent_goal_statuses()
    yield
    # Shutdown: cleanup if needed


app = FastAPI(
    title=settings.APP_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "app": settings.APP_NAME}
