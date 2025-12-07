"""
Network graph and relationship routes.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from nexus.utils import get_db
from nexus.db.schema import UserDb, XProfile, XConnection, XPosts
from nexus.models import XProfileResponse, NetworkStats

router = APIRouter(tags=["network"])


@router.get("/network/{username}/first-degree", response_model=List[XProfileResponse])
async def get_first_degree(username: str, db: AsyncSession = Depends(get_db)):
    """Get 1st degree connections (mutual connections from x_connections table)"""
    user_result = await db.execute(
        select(UserDb).where(UserDb.username == username)
    )
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.x_user_id:
        raise HTTPException(status_code=400, detail="User has no Twitter ID linked")

    # Get the mutual_ids array from x_connections
    connection_result = await db.execute(
        select(XConnection.mutual_ids)
        .where(XConnection.x_user_id == user.x_user_id)
    )
    mutual_ids = connection_result.scalar_one_or_none()

    if not mutual_ids:
        return []

    # Get all profiles for these mutual IDs
    result = await db.execute(
        select(XProfile)
        .where(XProfile.x_user_id.in_(mutual_ids))
    )

    return result.scalars().all()


@router.get("/network/{username}/second-degree", response_model=List[XProfileResponse])
async def get_second_degree(
    username: str,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get 2nd degree connections (mutuals of mutuals, excluding 1st degree and self)"""
    user_result = await db.execute(
        select(UserDb).where(UserDb.username == username)
    )
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.x_user_id:
        raise HTTPException(status_code=400, detail="User has no Twitter ID linked")

    # Get 1st degree mutual_ids
    first_degree_result = await db.execute(
        select(XConnection.mutual_ids)
        .where(XConnection.x_user_id == user.x_user_id)
    )
    first_degree_ids = first_degree_result.scalar_one_or_none()

    if not first_degree_ids:
        return []

    # Get all mutual_ids from each 1st degree connection
    second_degree_result = await db.execute(
        select(XConnection.mutual_ids)
        .where(XConnection.x_user_id.in_(first_degree_ids))
    )

    # Flatten and deduplicate all 2nd degree IDs
    second_degree_ids = set()
    for row in second_degree_result.scalars().all():
        if row:
            second_degree_ids.update(row)

    # Exclude self and 1st degree connections
    second_degree_ids.discard(user.x_user_id)
    second_degree_ids = second_degree_ids - set(first_degree_ids)

    if not second_degree_ids:
        return []

    # Get profiles for 2nd degree connections
    result = await db.execute(
        select(XProfile)
        .where(XProfile.x_user_id.in_(list(second_degree_ids)))
        .limit(limit)
    )

    return result.scalars().all()


@router.get("/network/{username}/stats", response_model=NetworkStats)
async def get_network_stats(username: str, db: AsyncSession = Depends(get_db)):
    """Get statistics about a user's scraped network"""
    user_result = await db.execute(
        select(UserDb).where(UserDb.username == username)
    )
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    first_count = 0
    if user.x_user_id:
        # Get count of mutual_ids in x_connections
        connection_result = await db.execute(
            select(XConnection.mutual_ids)
            .where(XConnection.x_user_id == user.x_user_id)
        )
        mutual_ids = connection_result.scalar_one_or_none()
        first_count = len(mutual_ids) if mutual_ids else 0

    profiles_count = await db.execute(select(func.count(XProfile.x_user_id)))
    posts_count = await db.execute(select(func.count(XPosts.x_user_id)))

    return NetworkStats(
        first_degree_count=first_count,
        profiles_indexed=profiles_count.scalar() or 0,
        posts_indexed=posts_count.scalar() or 0
    )
