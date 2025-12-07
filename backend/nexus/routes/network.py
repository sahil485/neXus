"""
Network graph and relationship routes.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from nexus.utils import get_db
from nexus.db.schema import UserDb, XProfile, XConnection, XTweet
from nexus.models import XProfileResponse, NetworkStats

router = APIRouter(tags=["network"])


@router.get("/network/{username}/first-degree", response_model=List[XProfileResponse])
async def get_first_degree(username: str, db: AsyncSession = Depends(get_db)):
    """Get 1st degree connections (people the user follows)"""
    user_result = await db.execute(
        select(UserDb).where(UserDb.username == username)
    )
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.x_user_id:
        raise HTTPException(status_code=400, detail="User has no Twitter ID linked")

    result = await db.execute(
        select(XProfile)
        .join(XConnection, XConnection.following_id == XProfile.x_user_id)
        .where(XConnection.follower_id == user.x_user_id)
    )

    return result.scalars().all()


@router.get("/network/{username}/second-degree", response_model=List[XProfileResponse])
async def get_second_degree(
    username: str,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get 2nd degree connections (people that 1st degree follows, excluding 1st degree)"""
    user_result = await db.execute(
        select(UserDb).where(UserDb.username == username)
    )
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.x_user_id:
        raise HTTPException(status_code=400, detail="User has no Twitter ID linked")

    # Subquery for 1st degree user IDs
    first_degree_subq = (
        select(XConnection.following_id)
        .where(XConnection.follower_id == user.x_user_id)
    ).subquery()

    # Get 2nd degree: people that 1st degree follows, excluding 1st degree themselves
    result = await db.execute(
        select(XProfile)
        .join(XConnection, XConnection.following_id == XProfile.x_user_id)
        .where(
            XConnection.follower_id.in_(select(first_degree_subq)),
            ~XProfile.x_user_id.in_(select(first_degree_subq)),
            XProfile.x_user_id != user.x_user_id
        )
        .distinct()
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
        first_degree_count = await db.execute(
            select(func.count(XConnection.id))
            .where(XConnection.follower_id == user.x_user_id)
        )
        first_count = first_degree_count.scalar() or 0

    profiles_count = await db.execute(select(func.count(XProfile.x_user_id)))
    tweets_count = await db.execute(select(func.count(XTweet.tweet_id)))

    return NetworkStats(
        first_degree_count=first_count,
        profiles_indexed=profiles_count.scalar() or 0,
        tweets_indexed=tweets_count.scalar() or 0
    )
