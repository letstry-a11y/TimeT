from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "timetracker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.worker.tasks.progress",
        "app.worker.tasks.reports",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes
    worker_prefetch_multiplier=1,
)

# Periodic tasks (beat schedule)
celery_app.conf.beat_schedule = {
    "aggregate-progress-hourly": {
        "task": "app.worker.tasks.progress.aggregate_all_goal_progress",
        "schedule": 3600.0,  # Every hour
    },
}
