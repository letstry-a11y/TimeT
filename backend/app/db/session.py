from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.config import settings

# SQLite needs special configuration for async
connect_args = {}
poolclass = None
is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if is_sqlite:
    connect_args = {"check_same_thread": False}
    poolclass = StaticPool

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    connect_args=connect_args,
    poolclass=poolclass,
)

if is_sqlite:
    # 开启 WAL 模式并设置忙等待，避免多并发下 "database is locked" 导致的偶发访问失败
    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        # WAL: 读写不再互相阻塞
        cursor.execute("PRAGMA journal_mode=WAL")
        # 遇到锁时最多等待 5 秒再报错，而不是立即失败
        cursor.execute("PRAGMA busy_timeout=5000")
        # 平衡持久性与写入性能
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

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
