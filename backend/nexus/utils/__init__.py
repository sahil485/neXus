"""
Utility functions and helpers for neXus backend.
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from nexus.db import async_session_maker


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Database session dependency for FastAPI routes."""
    async with async_session_maker() as session:
        yield session
