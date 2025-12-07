from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from nexus.utils import get_db
from nexus.models import User
from nexus.db import UserDb

router = APIRouter(tags=["users"])


@router.post("/user/upsert")
async def create_or_update_user(user: User, db: AsyncSession = Depends(get_db)):
    """Store or update user data from OAuth flow"""
    try:
        print(f"User: {user}")
        result = await db.execute(select(UserDb).where(UserDb.username == user.username))
        existing = result.scalar_one_or_none()

        if existing:
            existing.name = user.name
            existing.profile_pic = str(user.profile_pic)
            existing.followers = user.followers
            existing.following = user.following
            existing.oauth_access_token = user.oauth_access_token
            existing.updated_at = datetime.utcnow()
            user_id = existing.id
        else:
            new_user = UserDb(
                name=user.name,
                username=user.username,
                profile_pic=str(user.profile_pic),
                followers=user.followers,
                following=user.following,
                oauth_access_token=user.oauth_access_token,
            )
            db.add(new_user)
            await db.flush()
            user_id = new_user.id

        await db.commit()

        return {
            "success": True,
            "user_id": user_id,
            "username": user.username,
        }
    except Exception as e:
        print(f"Error: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to store user: {str(e)}")


@router.get("/user/{username}/token")
async def get_token_for_user(username: str, db: AsyncSession = Depends(get_db)):
    """Get OAuth access token for a user by username"""
    result = await db.execute(select(UserDb).where(UserDb.username == username))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found")

    return {
        "username": user.username,
        "oauth_access_token": user.oauth_access_token,
    }
