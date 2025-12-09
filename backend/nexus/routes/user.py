from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime
import logging
from nexus.utils import get_db
from nexus.models import User
from nexus.db import UserDb, XProfile, async_session_maker
from nexus.services.scraper import scrape_connections, scrape_posts_for_user_network
from nexus.services.twitter_client import TwitterClient

logger = logging.getLogger(__name__)
router = APIRouter(tags=["users"])


async def _background_scrape_new_user(x_user_id: str):
    """Background task for NEW users only - scrape connections then posts.

    This only runs once for new users to build their initial network.
    """
    try:
        logger.info(f"🚀 Starting initial scraping for NEW user {x_user_id}")

        # Step 1: Scrape connections (only for new users)
        async with async_session_maker() as scrape_session:
            result = await scrape_session.execute(select(UserDb).where(UserDb.x_user_id == x_user_id))
            db_user = result.scalar_one()

            logger.info(f"📊 Step 1/2: Scraping connections for NEW user {db_user.username}")
            scrape_result = await scrape_connections(db_user, scrape_session)

            logger.info(f"✅ Connections complete:")
            logger.info(f"  - {scrape_result['profiles_added']} profiles added")
            logger.info(f"  - {scrape_result['mutual_count']} 1st degree connections")
            logger.info(f"  - {scrape_result['second_degree_count']} 2nd degree connections")

        # Step 2: Scrape posts for new user's network
        async with async_session_maker() as posts_session:
            result = await posts_session.execute(select(UserDb).where(UserDb.x_user_id == x_user_id))
            db_user = result.scalar_one()

            logger.info(f"📝 Step 2/2: Scraping posts for NEW user {db_user.username}'s network")
            posts_result = await scrape_posts_for_user_network(db_user, posts_session)

            logger.info(f"✅ Posts complete:")
            logger.info(f"  - {posts_result['first_degree_posts']} 1st degree posts")
            logger.info(f"  - {posts_result['second_degree_posts']} 2nd degree posts")
            logger.info(f"  - {posts_result['total_posts']} total posts")

            # Update last_scraped_at
            db_user.last_scraped_at = datetime.utcnow()
            await posts_session.commit()
            logger.info(f"✅ Updated last_scraped_at for {db_user.username}")

        logger.info(f"🎉 Initial scraping complete for NEW user {db_user.username}")

    except Exception as scrape_error:
        logger.exception(f"❌ Initial scraping failed for new user {x_user_id}: {scrape_error}")


async def _background_scrape_existing_user(x_user_id: str):
    """Background task for EXISTING users - only scrape posts if > 1 hour old.

    This runs on login for existing users - NO connection scraping.
    """
    try:
        from datetime import timedelta

        async with async_session_maker() as posts_session:
            result = await posts_session.execute(select(UserDb).where(UserDb.x_user_id == x_user_id))
            db_user = result.scalar_one()

            # Only scrape posts if last_scraped_at is > 1 hour old or NULL
            one_hour_ago = datetime.utcnow() - timedelta(hours=1)
            should_scrape_posts = (
                db_user.last_scraped_at is None or
                db_user.last_scraped_at < one_hour_ago
            )

            if should_scrape_posts:
                logger.info(f"📝 Scraping posts for EXISTING user {db_user.username}'s network (last scraped: {db_user.last_scraped_at})")
                posts_result = await scrape_posts_for_user_network(db_user, posts_session)

                logger.info(f"✅ Posts complete:")
                logger.info(f"  - {posts_result['first_degree_posts']} 1st degree posts")
                logger.info(f"  - {posts_result['second_degree_posts']} 2nd degree posts")
                logger.info(f"  - {posts_result['total_posts']} total posts")

                # Update last_scraped_at
                db_user.last_scraped_at = datetime.utcnow()
                await posts_session.commit()
                logger.info(f"✅ Updated last_scraped_at for {db_user.username}")
            else:
                logger.info(f"⏭️  Skipping posts scrape for {db_user.username} - last scraped at {db_user.last_scraped_at} (< 1 hour ago)")

    except Exception as scrape_error:
        logger.exception(f"❌ Posts scraping failed for existing user {x_user_id}: {scrape_error}")


@router.post("/users/upsert")
async def create_or_update_user(
    user: User,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Store or update user data from OAuth flow"""
    try:
        client = TwitterClient(user.oauth_access_token)
        me_profile = await client.get_me()
        x_user_id = me_profile.x_user_id

        logger.info(f"Upserting user: {user.username} (X ID: {x_user_id})")
        result = await db.execute(select(UserDb).where(UserDb.x_user_id == x_user_id))
        existing = result.scalar_one_or_none()
        is_new_user = False

        if existing:
            existing.name = user.name
            existing.username = user.username
            existing.profile_pic = str(user.profile_pic)
            existing.followers = user.followers
            existing.following = user.following
            existing.oauth_access_token = user.oauth_access_token
            existing.updated_at = datetime.utcnow()
        else:
            is_new_user = True
            new_user_record = UserDb(
                x_user_id=x_user_id,
                name=user.name,
                username=user.username,
                profile_pic=str(user.profile_pic),
                followers=user.followers,
                following=user.following,
                oauth_access_token=user.oauth_access_token,
            )
            db.add(new_user_record)

        profile_stmt = insert(XProfile).values(
            x_user_id=x_user_id,
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

        # # Schedule appropriate background scraping based on user status
        # if is_new_user:
        #     logger.info(f"📅 Scheduling full scraping for NEW user {user.username}")
        #     background_tasks.add_task(_background_scrape_new_user, x_user_id)
        # else:
        #     logger.info(f"📅 Scheduling posts scraping for EXISTING user {user.username}")
        #     background_tasks.add_task(_background_scrape_existing_user, x_user_id)

        return {
            "success": True,
            "x_user_id": x_user_id,
            "username": user.username,
            "is_new_user": is_new_user,
            "scraping_scheduled": is_new_user,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error upserting user: {str(e)}")
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
            "x_user_id": u.x_user_id,
            "username": u.username,
            "name": u.name,
            "profile_pic": u.profile_pic,
            "followers": u.followers,
            "following": u.following,
        }
        for u in users
    ]