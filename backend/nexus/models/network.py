from pydantic import BaseModel


class NetworkStats(BaseModel):
    """Statistics about a user's scraped network"""
    first_degree_count: int
    profiles_indexed: int
    posts_indexed: int
