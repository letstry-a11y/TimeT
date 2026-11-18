# TimeTracker - Goal-Oriented Time Tracking System

A personal time journal built with FastAPI and Next.js. The local Docker stack serves the app through Nginx and keeps SQLite data in the `timetracker_backend_data` volume.

## Features

- **Vision Management**: Define long-term visions and track progress
- **Goal Hierarchy**: Support for yearly and quarterly goals with parent-child relationships
- **Time Tracking**: Real-time clock-in/out and manual time entry
- **Time journal** (`/dashboard`): Log goal work, travel, rest or everyday activities. Pick an open interval to backfill or confirm a plan with its actual times.
- **Goals and rewards** (`/goals#rewards`): Collect one personal reward per explicitly completed goal and optionally keep a note of the outcome.
- **Periodic reviews** (`/reviews`): Compare weeks, months, quarters, years and five-year blocks, add a reflection and a next step, and save a private version or export Markdown. Archived versions retain the figures visible at the time of saving.
- **Reports**: Vision alignment and goal progress reports
- **Async Tasks**: Celery-based background task processing

## Tech Stack

### Backend
- **Framework**: FastAPI + Python 3.10+
- **Database**: SQLite in the local Docker deployment, PostgreSQL supported for development
- **ORM**: SQLAlchemy 2.0 (Async)
- **Migrations**: Alembic
- **Task Queue**: Celery + Redis
- **Authentication**: JWT

## Quick Start

### 1. Start Docker Services

```bash
docker-compose -f docker-compose.dev.yml up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379

### 2. Set Up Python Environment

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 4. Run Database Migrations

```bash
alembic upgrade head
```

### 5. Start the Server

```bash
python run.py
# or
uvicorn app.main:app --reload
```

### 6. Start Celery Worker (Optional)

```bash
celery -A app.worker.celery_app worker --loglevel=info
```

## API Documentation

Once running, access:
- Swagger UI: http://localhost:8000/api/v1/docs
- ReDoc: http://localhost:8000/api/v1/redoc

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login and get tokens
- `POST /api/v1/auth/refresh` - Refresh access token

### Users
- `GET /api/v1/users/me` - Get current user
- `PUT /api/v1/users/me` - Update current user

### Visions
- `GET /api/v1/visions` - List visions
- `POST /api/v1/visions` - Create vision
- `GET /api/v1/visions/{id}` - Get vision
- `PUT /api/v1/visions/{id}` - Update vision
- `DELETE /api/v1/visions/{id}` - Delete vision

### Goals
- `GET /api/v1/goals` - List goals (with filters)
- `POST /api/v1/goals` - Create goal
- `GET /api/v1/goals/{id}` - Get goal
- `GET /api/v1/goals/{id}/tree` - Get goal hierarchy tree
- `PUT /api/v1/goals/{id}` - Update goal
- `DELETE /api/v1/goals/{id}` - Delete goal

### Time Logs
- `GET /api/v1/timelogs` - List time logs
- `GET /api/v1/timelogs/current` - Get active session
- `POST /api/v1/timelogs/start` - Start clock-in
- `PATCH /api/v1/timelogs/{id}/stop` - Stop clock-in
- `POST /api/v1/timelogs` - Manual entry
- `PUT /api/v1/timelogs/{id}` - Update time log
- `DELETE /api/v1/timelogs/{id}` - Delete time log

### Reports
- `GET /api/v1/reports/vision-alignment` - Vision alignment report
- `GET /api/v1/reports/goal-progress` - Goal progress report
- `GET /api/v1/reports/weekly` - Weekly time report

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── deps.py          # Dependencies (auth, db)
│   │   └── v1/
│   │       ├── endpoints/   # API endpoints
│   │       └── router.py    # API router
│   ├── core/
│   │   ├── config.py        # Settings
│   │   └── security.py      # JWT/password utils
│   ├── crud/                # Database operations
│   ├── db/
│   │   ├── base.py          # SQLAlchemy base
│   │   └── session.py       # Database session
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic schemas
│   ├── services/            # Business logic
│   └── worker/              # Celery tasks
│       └── tasks/
├── alembic/                 # Database migrations
├── requirements.txt
└── run.py
```

## Goal Hierarchy Rules

1. **Yearly goals** must be linked to a vision
2. **Quarterly goals** must be linked to a yearly goal (parent)
3. Time can only be logged to **quarterly goals**
4. Progress automatically rolls up from quarterly to yearly goals

## License

MIT
