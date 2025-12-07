import asyncio

from nexus.db import Base, engine, UserDb  # noqa: F401


async def init() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables created successfully!")


if __name__ == "__main__":
    asyncio.run(init())
