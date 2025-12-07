"""
Network scraping and data retrieval routes.
Handles fetching profiles, follows, and tweets from Twitter API.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime
from typing import List

from nexus.utils import get_db
from nexus.db.schema import UserDb, XProfile, XFollow, XTweet
from nexus.models.user import XProfileResponse, XTweetResponse, NetworkStats
from nexus.services.twitter_client import TwitterClient

router = APIRouter(tags=["network"])


# ============ Profile Endpoints ============

@router.get("/profiles/{x_user_id}", response_model=XProfileResponse)
async def get_profile(x_user_id: str, db: AsyncSession = Depends(get_db)):
    """Get a profile from our database"""
    result = await db.execute(
        select(XProfile).where(XProfile.x_user_id == x_user_id)
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return profile


@router.get("/profiles", response_model=List[XProfileResponse])
async def list_profiles(
    limit: int = 100, 
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """List all profiles in database"""
    result = await db.execute(
        select(XProfile).limit(limit).offset(offset)
    )
    return result.scalars().all()


# ============ Network Endpoints ============

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
        .join(XFollow, XFollow.following_id == XProfile.x_user_id)
        .where(XFollow.follower_id == user.x_user_id)
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
        select(XFollow.following_id)
        .where(XFollow.follower_id == user.x_user_id)
    ).subquery()
    
    # Get 2nd degree: people that 1st degree follows, excluding 1st degree themselves
    result = await db.execute(
        select(XProfile)
        .join(XFollow, XFollow.following_id == XProfile.x_user_id)
        .where(
            XFollow.follower_id.in_(select(first_degree_subq)),
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
            select(func.count(XFollow.id))
            .where(XFollow.follower_id == user.x_user_id)
        )
        first_count = first_degree_count.scalar() or 0
    
    profiles_count = await db.execute(select(func.count(XProfile.x_user_id)))
    tweets_count = await db.execute(select(func.count(XTweet.tweet_id)))
    
    return NetworkStats(
        first_degree_count=first_count,
        profiles_indexed=profiles_count.scalar() or 0,
        tweets_indexed=tweets_count.scalar() or 0
    )


# ============ Scraping Endpoints ============

@router.post("/scrape/following/{username}")
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
            follow_stmt = insert(XFollow).values(
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


@router.post("/scrape/tweets/{x_user_id}")
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


@router.get("/tweets/{x_user_id}", response_model=List[XTweetResponse])
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
