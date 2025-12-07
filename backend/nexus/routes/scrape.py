"""
Scraping routes for fetching data from Twitter API.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime

from nexus.utils import get_db
from nexus.db.schema import UserDb, XProfile, XConnection, XTweet
from nexus.services.twitter_client import TwitterClient

router = APIRouter(tags=["scrape"])


@router.post("/following/{username}")
async def scrape_following(username: str, db: AsyncSession = Depends(get_db)):
    """Scrape all users that the given user follows from Twitter API"""
    result = await db.execute(
        select(UserDb).where(UserDb.username == username)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.oauth_access_token:
        raise HTTPException(status_code=401, detail="No access token available")

    if not user.x_user_id:
        raise HTTPException(status_code=400, detail="User has no Twitter ID. Try re-authenticating.")

    client = TwitterClient(user.oauth_access_token)

    try:
        following_users = await client.get_all_following(user.x_user_id)

        profiles_added = 0
        follows_added = 0

        for profile_data in following_users:
            # Upsert profile into x_profiles
            stmt = insert(XProfile).values(
                x_user_id=profile_data.x_user_id,
                username=profile_data.username,
                name=profile_data.name,
                bio=profile_data.bio,
                location=profile_data.location,
                profile_image_url=profile_data.profile_image_url,
                verified=profile_data.verified,
                followers_count=profile_data.followers_count,
                following_count=profile_data.following_count,
                tweet_count=profile_data.tweet_count,
                listed_count=profile_data.listed_count,
                is_protected=profile_data.is_protected,
                account_created_at=profile_data.account_created_at,
                last_updated_at=datetime.utcnow()
            ).on_conflict_do_update(
                index_elements=['x_user_id'],
                set_={
                    'username': profile_data.username,
                    'name': profile_data.name,
                    'bio': profile_data.bio,
                    'followers_count': profile_data.followers_count,
                    'following_count': profile_data.following_count,
                    'last_updated_at': datetime.utcnow()
                }
            )
            await db.execute(stmt)
            profiles_added += 1

            # Add follow relationship
            follow_stmt = insert(XConnection).values(
                follower_id=user.x_user_id,
                following_id=profile_data.x_user_id,
                discovered_at=datetime.utcnow()
            ).on_conflict_do_nothing()
            await db.execute(follow_stmt)
            follows_added += 1

        user.last_scraped_at = datetime.utcnow()
        await db.commit()

        return {
            "success": True,
            "profiles_added": profiles_added,
            "follows_added": follows_added,
            "message": f"Successfully scraped {profiles_added} profiles"
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")


@router.post("/tweets/{x_user_id}")
async def scrape_user_tweets(
    x_user_id: str,
    count: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Scrape recent tweets for a specific user"""
    result = await db.execute(
        select(UserDb).where(UserDb.oauth_access_token.isnot(None)).limit(1)
    )
    app_user = result.scalar_one_or_none()

    if not app_user:
        raise HTTPException(status_code=401, detail="No access token available")

    profile_result = await db.execute(
        select(XProfile).where(XProfile.x_user_id == x_user_id)
    )
    profile = profile_result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found in database")

    if profile.is_protected:
        return {"success": False, "message": "Cannot fetch tweets from protected account"}

    client = TwitterClient(app_user.oauth_access_token)

    try:
        tweets = await client.get_user_tweets_batch(x_user_id, count)

        tweets_added = 0
        for tweet_data in tweets:
            stmt = insert(XTweet).values(
                tweet_id=tweet_data.tweet_id,
                author_id=tweet_data.author_id,
                content=tweet_data.content,
                created_at=tweet_data.created_at,
                like_count=tweet_data.like_count,
                retweet_count=tweet_data.retweet_count,
                reply_count=tweet_data.reply_count,
                quote_count=tweet_data.quote_count,
                impression_count=tweet_data.impression_count,
                language=tweet_data.language,
                conversation_id=tweet_data.conversation_id,
                fetched_at=datetime.utcnow()
            ).on_conflict_do_update(
                index_elements=['tweet_id'],
                set_={
                    'like_count': tweet_data.like_count,
                    'retweet_count': tweet_data.retweet_count,
                    'fetched_at': datetime.utcnow()
                }
            )
            await db.execute(stmt)
            tweets_added += 1

        await db.commit()

        return {
            "success": True,
            "tweets_added": tweets_added,
            "username": profile.username
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Tweet scraping failed: {str(e)}")
