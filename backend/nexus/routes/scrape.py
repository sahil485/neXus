"""
Scraping routes for fetching data from Twitter API.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime
from pydantic import BaseModel

from nexus.utils import get_db
from nexus.db.schema import UserDb, XProfile, XConnection, XPosts
from nexus.services.twitter_client import TwitterClient
from nexus.services.scraper import scrape_posts_for_user_network, scrape_connections
from nexus.services.embeddings import EmbeddingsService

router = APIRouter(tags=["scrape"])


class ScrapeRequest(BaseModel):
    x_user_id: str
    access_token: str

@router.post("/following/{username}")
async def scrape_following(
    username: str, 
    request_data: ScrapeRequest,
    db: AsyncSession = Depends(get_db)
):
    """Scrape all users that the given user follows from Twitter API"""
    x_user_id = request_data.x_user_id
    access_token = request_data.access_token

    if not access_token:
        raise HTTPException(status_code=401, detail="No access token provided")

    if not x_user_id:
        raise HTTPException(status_code=400, detail="No user ID provided")

    client = TwitterClient(access_token)

    try:
        following_users = await client.get_all_following(x_user_id)

        profiles_added = 0
        follows_added = 0

        for profile_data in following_users:
            # Remove timezone from account_created_at if present
            account_created_at = profile_data.account_created_at
            if account_created_at and account_created_at.tzinfo:
                account_created_at = account_created_at.replace(tzinfo=None)
            
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
                account_created_at=account_created_at,
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

            # Skip connection tracking - using Supabase structure
            # Connection data is already in x_connections table with mutual_ids array
            follows_added += 1

        await db.commit()

        # Step 2: Generate embeddings with Grok summaries
        print(f"Starting RAG ingestion for {profiles_added} profiles...")
        embeddings_result = {"processed": 0, "errors": 0}
        
        try:
            embeddings_service = EmbeddingsService()
            profile_ids = [p.x_user_id for p in following_users]
            
            embeddings_result = await embeddings_service.generate_embeddings_for_profiles(
                db=db,
                x_user_ids=profile_ids,
                batch_size=50
            )
            print(f"RAG ingestion complete: {embeddings_result['message']}")
        except Exception as e:
            print(f"Error generating embeddings: {e}")
            embeddings_result = {"processed": 0, "errors": profiles_added, "message": str(e)}

        return {
            "success": True,
            "profiles_added": profiles_added,
            "follows_added": follows_added,
            "embeddings_generated": embeddings_result.get("processed", 0),
            "embeddings_errors": embeddings_result.get("errors", 0),
            "message": f"Successfully scraped {profiles_added} profiles with RAG embeddings"
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")


@router.post("/posts/{x_user_id}")
async def scrape_user_posts(
    x_user_id: str,
    count: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Scrape recent posts for a specific user and store as array of strings"""
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
        return {"success": False, "message": "Cannot fetch posts from protected account"}

    client = TwitterClient(app_user.oauth_access_token)

    try:
        posts_text = await client.get_user_posts_text(x_user_id, count)

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
            "success": True,
            "posts_count": len(posts_text),
            "username": profile.username
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Posts scraping failed: {str(e)}")


@router.post("/scrape/connections/{username}")
async def scrape_user_connections(username: str, db: AsyncSession = Depends(get_db)):
    """Scrape all connections (1st and 2nd degree) for a user"""
    result = await db.execute(
        select(UserDb).where(UserDb.username == username)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        scrape_result = await scrape_connections(user, db)

        return {
            "success": True,
            "message": "Connections scraped successfully",
            **scrape_result
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Connection scraping failed: {str(e)}")


@router.post("/scrape/posts/{username}")
async def scrape_network_posts(username: str, db: AsyncSession = Depends(get_db)):
    """Scrape posts for a user's entire network (1st and 2nd degree)"""
    result = await db.execute(
        select(UserDb).where(UserDb.username == username)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        posts_result = await scrape_posts_for_user_network(user, db)

        return {
            "success": True,
            "message": "Network posts scraped successfully",
            **posts_result
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Posts scraping failed: {str(e)}")
