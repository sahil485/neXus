from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class XProfileCreate(BaseModel):
    """Data for creating/updating an X profile"""
    x_user_id: str
    username: str
    name: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    profile_image_url: Optional[str] = None
    verified: bool = False
    followers_count: int = 0
    following_count: int = 0
    tweet_count: int = 0
    listed_count: int = 0
    is_protected: bool = False
    account_created_at: Optional[datetime] = None


class XProfileResponse(BaseModel):
    x_user_id: str
    username: str
    name: Optional[str]
    bio: Optional[str]
    location: Optional[str]
    profile_image_url: Optional[str]
    verified: bool
    followers_count: int
    following_count: int
    tweet_count: int
    is_protected: bool

    class Config:
        from_attributes = True
