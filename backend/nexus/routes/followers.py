from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime
from nexus.utils import get_db
from nexus.models import User
from nexus.db import UserDb, XProfile

router = APIRouter(tags=["users"])


@router.post("/users/upsert")
async def create_or_update_user(user: User, db: AsyncSession = Depends(get_db)):
    """Store or update user data from OAuth flow"""
    try:
        print(f"Upserting user: {user.username}")
        result = await db.execute(select(UserDb).where(UserDb.username == user.username))
        existing = result.scalar_one_or_none()

        if existing:
            existing.name = user.name
            existing.x_user_id = user.x_user_id
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
                x_user_id=user.x_user_id,
                profile_pic=str(user.profile_pic),
                followers=user.followers,
                following=user.following,
                oauth_access_token=user.oauth_access_token,
            )
            db.add(new_user)
            await db.flush()
            user_id = new_user.id

        # Also upsert into x_profiles so they appear in network queries
        if user.x_user_id:
            profile_stmt = insert(XProfile).values(
                x_user_id=user.x_user_id,
                username=user.username,
                name=user.name,
                profile_image_url=str(user.profile_pic),
                followers_count=user.followers,
                following_count=user.following,
                last_updated_at=datetime.utcnow()
            ).on_conflict_do_update(
                index_elements=['x_user_id'],
                set_={
                    'username': user.username,
                    'name': user.name,
                    'followers_count': user.followers,
                    'following_count': user.following,
                    'last_updated_at': datetime.utcnow()
                }
            )
            await db.execute(profile_stmt)

        await db.commit()

        return {
            "success": True,
            "user_id": user_id,
            "username": user.username,
        }
    except Exception as e:
        print(f"Error upserting user: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to store user: {str(e)}")


@router.get("/users/{username}")
async def get_user(username: str, db: AsyncSession = Depends(get_db)):
    """Get a user by username"""
    result = await db.execute(
        select(UserDb).where(UserDb.username == username)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": user.id,
        "x_user_id": user.x_user_id,
        "username": user.username,
        "name": user.name,
        "profile_pic": user.profile_pic,
        "followers": user.followers,
        "following": user.following,
        "last_scraped_at": user.last_scraped_at,
        "created_at": user.created_at,
    }


@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db)):
    """List all app users"""
    result = await db.execute(select(UserDb))
    users = result.scalars().all()
    
    return [
        {
            "id": u.id,
            "username": u.username,
            "name": u.name,
            "profile_pic": u.profile_pic,
            "followers": u.followers,
            "following": u.following,
        }
        for u in users
    ]
