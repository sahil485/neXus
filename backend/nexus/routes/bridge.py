"""
Route to find bridge profiles for introductions.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from nexus.utils import get_db
from nexus.db.schema import XProfile, XConnection

router = APIRouter(tags=["network"])


@router.get("/network/bridge/{current_user_id}/{target_user_id}")
async def get_bridge_profile(
    current_user_id: str,
    target_user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Find a bridge profile: someone who is:
    1. A 1st degree connection of the current user
    2. Also connected to the target user

    This enables warm introductions through mutual connections.
    """
    try:
        # Get current user's mutual connections (1st degree)
        result = await db.execute(
            select(XConnection).where(XConnection.x_user_id == current_user_id)
        )
        current_user_connection = result.scalar_one_or_none()

        if not current_user_connection or not current_user_connection.mutual_ids:
            print(f"No mutuals found for current user {current_user_id}")
            return {"bridge": None}

        current_mutuals = set(current_user_connection.mutual_ids)
        print(f"Current user has {len(current_mutuals)} mutuals")

        # Check each of the current user's mutuals to see if they also know the target
        for potential_bridge_id in current_mutuals:
            # Get this potential bridge's connections
            bridge_conn_result = await db.execute(
                select(XConnection).where(XConnection.x_user_id == potential_bridge_id)
            )
            bridge_connection = bridge_conn_result.scalar_one_or_none()

            if bridge_connection and bridge_connection.mutual_ids:
                # Check if the target is in this bridge's mutuals
                if target_user_id in bridge_connection.mutual_ids:
                    print(f"Found bridge: {potential_bridge_id} connects to both")
                    # Get the bridge profile
                    profile_result = await db.execute(
                        select(XProfile).where(XProfile.x_user_id == potential_bridge_id)
                    )
                    bridge_profile = profile_result.scalar_one_or_none()

                    if bridge_profile:
                        return {
                            "bridge": {
                                "x_user_id": bridge_profile.x_user_id,
                                "username": bridge_profile.username,
                                "name": bridge_profile.name,
                                "bio": bridge_profile.bio or "",
                                "profile_image_url": bridge_profile.profile_image_url,
                                "followers_count": bridge_profile.followers_count or 0,
                                "following_count": bridge_profile.following_count or 0,
                            }
                        }

        print(f"No bridge found between {current_user_id} and {target_user_id}")
        return {"bridge": None}

    except Exception as e:
        print(f"Error finding bridge profile: {e}")
        import traceback
        traceback.print_exc()
        return {"bridge": None}
