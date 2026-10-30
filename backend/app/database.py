import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import DATABASE_URL

# Disable SQL echo in production; enable only when DEBUG=true.
_debug = os.getenv("DEBUG", "false").lower() == "true"

engine = create_async_engine(DATABASE_URL, echo=_debug)
SessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


async def get_db():
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
