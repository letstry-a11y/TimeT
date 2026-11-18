from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, visions, goals, timelogs, reports, journal

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(visions.router, prefix="/visions", tags=["visions"])
api_router.include_router(goals.router, prefix="/goals", tags=["goals"])
api_router.include_router(timelogs.router, prefix="/timelogs", tags=["timelogs"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(journal.router, prefix="/journal", tags=["journal"])
