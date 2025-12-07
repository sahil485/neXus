"""
Helper functions for scraping user data from Twitter API.
"""

import os
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime

from nexus.db.schema import UserDb, XProfile, XConnection
from nexus.services.twitter_client import TwitterClient
from nexus.models.x_profile import XProfileCreate


async def retrieve_connections(x_user_id: str) -> dict:
    bearer_token = os.getenv("BEARER_TOKEN")
    if not bearer_token:
        raise ValueError("BEARER_TOKEN not configured in environment")

    client = TwitterClient(bearer_token)
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


async def add_to_db(x_user_id: str, mutual: List[XProfileCreate], db: AsyncSession) -> int:
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

    await db.commit()

    return profiles_added


async def scrape_connections(user: UserDb, db: AsyncSession) -> dict:
    connections_data = await retrieve_connections(user.x_user_id)
    profiles_added = await add_to_db(user.x_user_id, connections_data["mutual"], db)

    second_degree_mutuals = []
    for mutual_profile in connections_data["mutual"]:
        mutual_connections_data = await retrieve_connections(mutual_profile.x_user_id)

        filtered_mutuals = [
            profile for profile in mutual_connections_data["mutual"]
            if profile.x_user_id != user.x_user_id
        ]

        await add_to_db(mutual_profile.x_user_id, filtered_mutuals, db)
        second_degree_mutuals.extend(filtered_mutuals)

    return {
        **connections_data,
        "profiles_added": profiles_added,
        "second_degree_mutuals": second_degree_mutuals,
        "second_degree_count": len(second_degree_mutuals),
    }
