"""
Helper functions for scraping user data from Twitter API.
"""

import os
import logging
import asyncio
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime

from nexus.db.schema import UserDb, XProfile, XConnection, XPosts
from nexus.services.twitter_client import TwitterClient
from nexus.services.embeddings import EmbeddingsService
from nexus.models.x_profile import XProfileCreate
from nexus.utils.staleness import should_refresh_posts, should_refresh_profile
from sqlalchemy import select

logger = logging.getLogger(__name__)

# Phase 1 Optimization Limits
MAX_SECOND_DEGREE_PROFILES = 100  # Limit 2nd degree expansion
MIN_FOLLOWERS_FOR_POSTS = 50  # Skip low-value profiles for posts


async def retrieve_connections(x_user_id: str) -> dict:
    logger.info(f"🔍 Retrieving connections for user {x_user_id}")
    bearer_token = os.getenv("BEARER_TOKEN")
    if not bearer_token:
        raise ValueError("BEARER_TOKEN not configured in environment")

    client = TwitterClient(bearer_token)

    # Fetch ALL following/followers (pagination handled by client)
    following = await client.get_all_following(x_user_id)
    followers = await client.get_all_followers(x_user_id)

    following_ids = {profile.x_user_id for profile in following}
    followers_ids = {profile.x_user_id for profile in followers}
    mutual_ids = following_ids & followers_ids

    mutual = [profile for profile in following if profile.x_user_id in mutual_ids]

    return {
        "following": following,
        "followers": followers,
        "mutual": mutual,
        "following_count": len(following),
        "followers_count": len(followers),
        "mutual_count": len(mutual),
    }


async def scrape_posts_for_profiles(profiles: List[XProfile], db: AsyncSession) -> int:
    """Scrape the 50 most recent posts for each profile and store them"""
    bearer_token = os.getenv("BEARER_TOKEN")
    if not bearer_token:
        logger.warning("⚠️  BEARER_TOKEN not configured - skipping posts scraping")
        return 0

    client = TwitterClient(bearer_token)
    posts_added = 0
    skipped_fresh = 0
    skipped_protected = 0
    skipped_low_value = 0
    total = len(profiles)
    logger.info(f"📝 Starting posts scraping for {total} profiles...")

    for idx, profile in enumerate(profiles, 1):
        # Skip protected accounts (can't access anyway)
        if profile.is_protected:
            logger.debug(f"  ⏭️  Skipping protected account @{profile.username} ({idx}/{total})")
            skipped_protected += 1
            continue
        
        # Skip low-value profiles (few followers = less valuable signal)
        if profile.followers_count < MIN_FOLLOWERS_FOR_POSTS:
            logger.debug(f"  ⏭️  Skipping low-follower account @{profile.username} ({profile.followers_count} followers)")
            skipped_low_value += 1
            continue
        
        # Check if posts are fresh (staleness check)
        existing_posts = await db.execute(
            select(XPosts).where(XPosts.x_user_id == profile.x_user_id)
        )
        posts_record = existing_posts.scalar_one_or_none()
        
        if posts_record and not should_refresh_posts(posts_record.discovered_at):
            logger.debug(f"  ⏭️  Skipping fresh posts for @{profile.username}")
            skipped_fresh += 1
            continue

        try:
            logger.info(f"  [{idx}/{total}] Scraping posts for @{profile.username} ({profile.x_user_id})")
            posts_text = await client.get_user_posts_text(profile.x_user_id, count=50)

            if posts_text and len(posts_text) > 0:
                stmt = insert(XPosts).values(
                    x_user_id=profile.x_user_id,
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
                posts_added += 1
        except Exception as e:
            logger.warning(f"  ⚠️  Failed to scrape posts for @{profile.username}: {str(e)}")
            # Rollback transaction to prevent "current transaction is aborted" errors
            await db.rollback()
            continue

    # Commit all the post inserts to database
    logger.info(f"💾 Committing {posts_added} post records to database...")
    await db.commit()
    logger.info(
        f"✅ Posts scraping complete: {posts_added} scraped, "
        f"{skipped_fresh} fresh, {skipped_protected} protected, "
        f"{skipped_low_value} low-value (total: {total})"
    )
    return posts_added


async def add_to_db(x_user_id: str, mutual: List[XProfileCreate], db: AsyncSession, scrape_posts: bool = True) -> int:
    profiles_added = 0
    for profile_data in mutual:
        account_created_at = profile_data.account_created_at
        if account_created_at and account_created_at.tzinfo:
            account_created_at = account_created_at.replace(tzinfo=None)

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

    mutual_user_ids = [profile.x_user_id for profile in mutual]

    connection_stmt = insert(XConnection).values(
        x_user_id=x_user_id,
        mutual_ids=mutual_user_ids,
        discovered_at=datetime.utcnow()
    ).on_conflict_do_update(
        index_elements=['x_user_id'],
        set_={
            'mutual_ids': mutual_user_ids,
            'discovered_at': datetime.utcnow()
        }
    )
    await db.execute(connection_stmt)

    if scrape_posts and mutual:
        logger.info(f"📝 Scraping posts for {len(mutual)} profiles...")
        await scrape_posts_for_profiles(mutual, db)

    # Commit profiles and connections to database
    logger.info(f"💾 Committing {profiles_added} profiles and connection data to database...")
    await db.commit()
    logger.info(f"✅ DATABASE COMMIT SUCCESS: Profiles and connections saved")

    return profiles_added


async def scrape_connections(user: UserDb, db: AsyncSession) -> dict:
    """Scrape 1st and 2nd degree connections with RAG embeddings"""
    print(f"Starting scrape for {user.username}...")
    
    # Step 1: Get 1st degree connections
    print("Fetching 1st degree connections...")
    connections_data = await retrieve_connections(user.x_user_id)
    profiles_added = await add_to_db(user.x_user_id, connections_data["mutual"], db)
    print(f"Added {profiles_added} 1st degree profiles")

    # Step 2: Get 2nd degree connections in parallel batches
    # OPTIMIZATION: Limit 2nd degree to avoid explosion
    logger.info(f"Fetching 2nd degree connections (limited to top {MAX_SECOND_DEGREE_PROFILES})...")
    second_degree_mutuals = []
    
    # Sort 1st degree by followers (prioritize influential connections)
    sorted_mutuals = sorted(
        connections_data["mutual"], 
        key=lambda p: p.followers_count, 
        reverse=True
    )
    limited_mutuals = sorted_mutuals[:MAX_SECOND_DEGREE_PROFILES]
    
    logger.info(
        f"Limited 2nd degree expansion: processing top {len(limited_mutuals)} "
        f"of {len(connections_data['mutual'])} 1st degree connections"
    )
    
    async def process_mutual(mutual_profile, idx, total):
        """Process one mutual connection's network"""
        logger.info(f"Processing {idx}/{total}: @{mutual_profile.username}")
        try:
            mutual_connections_data = await retrieve_connections(mutual_profile.x_user_id)
            filtered_mutuals = [
                profile for profile in mutual_connections_data["mutual"]
                if profile.x_user_id != user.x_user_id
            ]
            await add_to_db(mutual_profile.x_user_id, filtered_mutuals, db)
            return filtered_mutuals
        except Exception as e:
            logger.warning(f"Error processing @{mutual_profile.username}: {e}")
            return []
    
    # Process in parallel batches of 5
    batch_size = 5
    total_to_process = len(limited_mutuals)
    
    for i in range(0, total_to_process, batch_size):
        batch = limited_mutuals[i:i + batch_size]
        tasks = [process_mutual(mutual, i + idx + 1, total_to_process) for idx, mutual in enumerate(batch)]
        batch_results = await asyncio.gather(*tasks)
        
        for result in batch_results:
            second_degree_mutuals.extend(result)
        
        logger.info(f"Batch {i//batch_size + 1} complete. 2nd degree so far: {len(second_degree_mutuals)}")
    
    logger.info(f"Added {len(second_degree_mutuals)} 2nd degree profiles")

    # Step 3: Generate RAG embeddings
    print("Starting RAG ingestion...")
    embeddings_result = {"processed": 0, "errors": 0}
    
    try:
        embeddings_service = EmbeddingsService()
        all_profile_ids = [p.x_user_id for p in connections_data["mutual"]]
        all_profile_ids.extend([p.x_user_id for p in second_degree_mutuals])
        unique_ids = list(set(all_profile_ids))
        
        print(f"Generating embeddings for {len(unique_ids)} unique profiles...")
        embeddings_result = await embeddings_service.generate_embeddings_for_profiles(
            db=db, x_user_ids=unique_ids, batch_size=50
        )
        print(f"RAG complete: {embeddings_result['message']}")
    except Exception as e:
        print(f"Error generating embeddings: {e}")
        embeddings_result = {"processed": 0, "errors": len(unique_ids), "message": str(e)}

    logger.info(f"✅ Connection scrape complete: {len(connections_data['mutual'])} 1st degree, {len(second_degree_mutuals)} 2nd degree")

    return {
        **connections_data,
        "profiles_added": profiles_added,
        "second_degree_mutuals": second_degree_mutuals,
        "second_degree_count": len(second_degree_mutuals),
        "embeddings_generated": embeddings_result.get("processed", 0),
        "embeddings_errors": embeddings_result.get("errors", 0),
    }


async def scrape_posts_for_user_network(user: UserDb, db: AsyncSession) -> dict:
    """Scrape posts for ALL of a user's connections (1st and 2nd degree).

    This always scrapes all connections - no caching logic.
    Caller should decide when to run this (e.g., only if user.last_scraped_at > 1 hour).
    """
    logger.info(f"📝 Starting posts scrape for {user.username}'s entire network")

    from sqlalchemy import select
    result = await db.execute(
        select(XConnection.mutual_ids).where(XConnection.x_user_id == user.x_user_id)
    )
    first_degree_ids = result.scalar_one_or_none() or []

    if not first_degree_ids:
        logger.warning(f"No 1st degree connections found for {user.username}. Run scrape_connections first.")
        return {"first_degree_posts": 0, "second_degree_posts": 0}

    profiles_result = await db.execute(
        select(XProfile).where(XProfile.x_user_id.in_(first_degree_ids))
    )
    first_degree_profiles = profiles_result.scalars().all()

    logger.info(f"  ℹ️  Found {len(first_degree_profiles)} 1st degree connections")

    logger.info(f"📝 Scraping posts for {len(first_degree_profiles)} 1st degree connections...")
    first_posts_count = await scrape_posts_for_profiles(first_degree_profiles, db)

    second_degree_result = await db.execute(
        select(XConnection.mutual_ids).where(XConnection.x_user_id.in_(first_degree_ids))
    )

    second_degree_ids = set()
    for row in second_degree_result.scalars().all():
        if row:
            second_degree_ids.update(row)

    second_degree_ids.discard(user.x_user_id)
    second_degree_ids = second_degree_ids - set(first_degree_ids)


    logger.info(f"  ℹ️  Found {len(second_degree_ids)} 2nd degree connections")

    if second_degree_ids:
        profiles_result = await db.execute(
            select(XProfile).where(XProfile.x_user_id.in_(list(second_degree_ids)))
        )
        second_degree_profiles = profiles_result.scalars().all()

        logger.info(f"📝 Scraping posts for {len(second_degree_profiles)} 2nd degree connections...")
        second_posts_count = await scrape_posts_for_profiles(second_degree_profiles, db)
    else:
        second_posts_count = 0

    logger.info(f"🎉 Posts scraping complete: {first_posts_count} 1st degree, {second_posts_count} 2nd degree")

    return {
        "first_degree_posts": first_posts_count,
        "second_degree_posts": second_posts_count,
        "total_posts": first_posts_count + second_posts_count
    }
