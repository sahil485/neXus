"""
Tweet data retrieval routes.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from nexus.utils import get_db
from nexus.db.schema import XTweet
from nexus.models import XTweetResponse

router = APIRouter(tags=["tweets"])


@router.get("/tweets/{x_user_id}/get", response_model=List[XTweetResponse])
async def get_user_tweets(
    x_user_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get stored tweets for a user"""
    result = await db.execute(
        select(XTweet)
        .where(XTweet.author_id == x_user_id)
        .order_by(XTweet.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
