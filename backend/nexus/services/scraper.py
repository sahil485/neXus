"""
Helper functions for scraping user data from Twitter API.
"""

import os
import asyncio
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime

from nexus.db.schema import UserDb, XProfile, XConnection
from nexus.services.twitter_client import TwitterClient
from nexus.services.embeddings import EmbeddingsService
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
    """Scrape 1st and 2nd degree connections with RAG embeddings"""
    print(f"Starting scrape for {user.username}...")
    
    # Step 1: Get 1st degree connections
    print("Fetching 1st degree connections...")
    connections_data = await retrieve_connections(user.x_user_id)
    profiles_added = await add_to_db(user.x_user_id, connections_data["mutual"], db)
    print(f"Added {profiles_added} 1st degree profiles")

    # Step 2: Get 2nd degree connections in parallel batches
    print("Fetching 2nd degree connections in parallel...")
    second_degree_mutuals = []
    
    async def process_mutual(mutual_profile, idx, total):
        """Process one mutual connection's network"""
        print(f"Processing {idx}/{total}: @{mutual_profile.username}")
        try:
            mutual_connections_data = await retrieve_connections(mutual_profile.x_user_id)
            filtered_mutuals = [
                profile for profile in mutual_connections_data["mutual"]
                if profile.x_user_id != user.x_user_id
            ]
            await add_to_db(mutual_profile.x_user_id, filtered_mutuals, db)
            return filtered_mutuals
        except Exception as e:
            print(f"Error processing @{mutual_profile.username}: {e}")
            return []
    
    # Process in parallel batches of 5
    batch_size = 5
    total_mutuals = len(connections_data["mutual"])
    
    for i in range(0, total_mutuals, batch_size):
        batch = connections_data["mutual"][i:i + batch_size]
        tasks = [process_mutual(mutual, i + idx + 1, total_mutuals) for idx, mutual in enumerate(batch)]
        batch_results = await asyncio.gather(*tasks)
        
        for result in batch_results:
            second_degree_mutuals.extend(result)
        
        print(f"Batch {i//batch_size + 1} complete. 2nd degree so far: {len(second_degree_mutuals)}")
    
    print(f"Added {len(second_degree_mutuals)} 2nd degree profiles")

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

    return {
        **connections_data,
        "profiles_added": profiles_added,
        "second_degree_mutuals": second_degree_mutuals,
        "second_degree_count": len(second_degree_mutuals),
        "embeddings_generated": embeddings_result.get("processed", 0),
        "embeddings_errors": embeddings_result.get("errors", 0),
    }
