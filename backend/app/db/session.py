from sqlalchemy import event
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool, StaticPool

from app.core.config import settings


def make_database_engine(url: str, *, echo: bool = False):
    database = make_url(url)
    if database.get_backend_name() != "sqlite":
        return create_async_engine(url, echo=echo)

    memory = database.database in (None, "", ":memory:", "file::memory:") or database.query.get("mode") == "memory"
    # File-backed requests need independent transactions. Reusing one physical
    # connection lets concurrent sessions see and commit one another's writes.
    engine = create_async_engine(url, echo=echo, poolclass=StaticPool if memory else NullPool,
                                 connect_args={"check_same_thread": False, "timeout": 5})

    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragmas(connection, _record):
        cursor = connection.cursor()
        try:
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
        finally:
            cursor.close()

    return engine


engine = make_database_engine(settings.DATABASE_URL, echo=settings.DEBUG)
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize database tables."""
    from app.db.base import Base
    from app.models import user, vision, goal, task, time_log  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
