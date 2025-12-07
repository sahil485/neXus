"""
Posts data retrieval routes.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from typing import List
from datetime import datetime
import os

from nexus.utils import get_db
from nexus.db.schema import XPosts, XProfile
from nexus.services.twitter_client import TwitterClient

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
        return {"x_user_id": x_user_id, "posts": [], "posts_count": 0, "discovered_at": None}
    
    return {
        "x_user_id": posts_record.x_user_id,
        "posts": posts_record.posts,
        "posts_count": len(posts_record.posts),
        "discovered_at": posts_record.discovered_at
    }


@router.post("/posts/{x_user_id}/scrape")
async def scrape_user_posts(
    x_user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Scrape posts for a specific user by x_user_id"""
    bearer_token = os.getenv("BEARER_TOKEN")
    if not bearer_token:
        raise HTTPException(status_code=403, detail="BEARER_TOKEN not configured")

    profile_result = await db.execute(
        select(XProfile).where(XProfile.x_user_id == x_user_id)
    )
    profile = profile_result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Scrape the profile first.")

    if profile.is_protected:
        raise HTTPException(status_code=403, detail="Cannot scrape posts from protected account")

    client = TwitterClient(bearer_token)
    try:
        posts_text = await client.get_user_posts_text(x_user_id, count=50)

        if not posts_text:
            raise HTTPException(status_code=404, detail="No posts found for this user")

        stmt = insert(XPosts).values(
            x_user_id=x_user_id,
            posts=posts_text,
            discovered_at=datetime.utcnow()
        ).on_conflict_do_update(
            index_elements=['x_user_id'],
            set_={
                'posts': posts_text,
                'discovered_at': datetime.utcnow()
            }
        )
        await db.execute(stmt)
        await db.commit()

        return {
            "x_user_id": x_user_id,
            "posts_count": len(posts_text),
            "message": f"Successfully scraped {len(posts_text)} posts"
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to scrape posts: {str(e)}")
