"""
Posts data retrieval routes.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from nexus.utils import get_db
from nexus.db.schema import XPosts

router = APIRouter(tags=["posts"])


@router.get("/posts/{x_user_id}")
async def get_user_posts(
    x_user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get stored posts for a user as array of strings"""
    result = await db.execute(
        select(XPosts).where(XPosts.x_user_id == x_user_id)
    )
    posts_record = result.scalar_one_or_none()
    
    if not posts_record:
        raise HTTPException(status_code=404, detail="No posts found for this user")
    
    return {
        "x_user_id": posts_record.x_user_id,
        "posts": posts_record.posts,
        "posts_count": len(posts_record.posts),
        "discovered_at": posts_record.discovered_at
    }
