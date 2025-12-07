"""
Staleness checking utilities to avoid redundant API calls.

Determines if cached data is still fresh or needs to be refreshed.
"""

from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# TTL (Time-To-Live) configurations in hours
PROFILE_FRESHNESS_HOURS = 24  # Re-fetch profiles after 24 hours
CONNECTION_FRESHNESS_HOURS = 168  # Re-fetch connections after 7 days (168 hours)
POSTS_FRESHNESS_HOURS = 24  # Re-fetch posts after 24 hours
EMBEDDINGS_FRESHNESS_HOURS = 168  # Re-generate embeddings after 7 days


def is_stale(timestamp: datetime | None, max_age_hours: int) -> bool:
    """
    Check if a timestamp is stale (older than max_age_hours).
    
    Args:
        timestamp: The timestamp to check (or None)
        max_age_hours: Maximum age in hours before considered stale
        
    Returns:
        True if stale (needs refresh), False if still fresh
    """
    if timestamp is None:
        return True
    
    age_hours = (datetime.utcnow() - timestamp).total_seconds() / 3600
    return age_hours > max_age_hours


def get_age_hours(timestamp: datetime | None) -> float:
    """Get age of timestamp in hours."""
    if timestamp is None:
        return float('inf')
    return (datetime.utcnow() - timestamp).total_seconds() / 3600


def should_refresh_profile(last_updated_at: datetime | None) -> bool:
    """Check if a profile needs to be refreshed."""
    stale = is_stale(last_updated_at, PROFILE_FRESHNESS_HOURS)
    if not stale:
        age = get_age_hours(last_updated_at)
        logger.debug(f"Profile is fresh ({age:.1f}h old, max {PROFILE_FRESHNESS_HOURS}h)")
    return stale


def should_refresh_connections(discovered_at: datetime | None) -> bool:
    """Check if connection data needs to be refreshed."""
    stale = is_stale(discovered_at, CONNECTION_FRESHNESS_HOURS)
    if not stale:
        age = get_age_hours(discovered_at)
        logger.debug(f"Connections are fresh ({age:.1f}h old, max {CONNECTION_FRESHNESS_HOURS}h)")
    return stale


def should_refresh_posts(discovered_at: datetime | None) -> bool:
    """Check if posts need to be refreshed."""
    stale = is_stale(discovered_at, POSTS_FRESHNESS_HOURS)
    if not stale:
        age = get_age_hours(discovered_at)
        logger.debug(f"Posts are fresh ({age:.1f}h old, max {POSTS_FRESHNESS_HOURS}h)")
    return stale


def should_refresh_embeddings(last_updated_at: datetime | None) -> bool:
    """Check if embeddings need to be regenerated."""
    return is_stale(last_updated_at, EMBEDDINGS_FRESHNESS_HOURS)
