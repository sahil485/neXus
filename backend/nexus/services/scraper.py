"""
Helper functions for scraping user data from Twitter API.
"""

import os
import logging
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime

from nexus.db.schema import UserDb, XProfile, XConnection, XPosts
from nexus.models.x_profile import XProfileCreate
from nexus.services.twitter_client import TwitterClient

logger = logging.getLogger(__name__)


async def retrieve_connections(x_user_id: str) -> dict:
    logger.info(f"🔍 Retrieving connections for user {x_user_id}")
    bearer_token = os.getenv("BEARER_TOKEN")
    if not bearer_token:
        raise ValueError("BEARER_TOKEN not configured in environment")

    client = TwitterClient(bearer_token)

    following = await client.get_all_following(x_user_id, 10)

    followers = await client.get_all_followers(x_user_id, 10)

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
    total = len(profiles)
    logger.info(f"📝 Starting posts scraping for {total} profiles...")

    for idx, profile in enumerate(profiles, 1):
        # Skip protected accounts
        if profile.is_protected:
            logger.debug(f"  ⏭️  Skipping protected account @{profile.username} ({idx}/{total})")
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
            continue

    # Commit all the post inserts to database
    logger.info(f"💾 Committing {posts_added} post records to database...")
    await db.commit()
    logger.info(f"✅ DATABASE COMMIT SUCCESS: {posts_added}/{total} profiles with posts saved to DB")
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
    """Scrape connections ONLY - no posts. Returns connection data."""
    logger.info(f"🔗 Starting connection scrape for user {user.username}")

    connections_data = await retrieve_connections(user.x_user_id)
    profiles_added = await add_to_db(user.x_user_id, connections_data["mutual"], db, scrape_posts=False)

    second_degree_mutuals = []

    for idx, mutual_profile in enumerate(connections_data["mutual"], 1):
        logger.info(f"  [{idx}/{len(connections_data['mutual'])}] Fetching connections for @{mutual_profile.username}")
        mutual_connections_data = await retrieve_connections(mutual_profile.x_user_id)

        filtered_mutuals = [
            profile for profile in mutual_connections_data["mutual"]
            if profile.x_user_id != user.x_user_id
        ]

        await add_to_db(mutual_profile.x_user_id, filtered_mutuals, db, scrape_posts=False)
        second_degree_mutuals.extend(filtered_mutuals)

    logger.info(f"✅ Connection scrape complete: {len(connections_data['mutual'])} 1st degree, {len(second_degree_mutuals)} 2nd degree")

    return {
        **connections_data,
        "profiles_added": profiles_added,
        "second_degree_mutuals": second_degree_mutuals,
        "second_degree_count": len(second_degree_mutuals),
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
