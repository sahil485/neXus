from pydantic import BaseModel, HttpUrl
from typing import Optional, List
from datetime import datetime


# ============ App User Models ============

class Connection(BaseModel):
    name: str
    username: str
    profile_pic: HttpUrl


class User(BaseModel):
    """OAuth'd app user - sent from frontend after OAuth"""
    name: str
    username: str
    profile_pic: HttpUrl
    followers: int
    following: int
    oauth_access_token: str
    x_user_id: Optional[str] = None  # Twitter's user ID


class UserResponse(BaseModel):
    success: bool
    user_id: int
    username: str


# ============ X Profile Models ============

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


# ============ X Tweet Models ============

class XTweetCreate(BaseModel):
    """Data for creating a tweet record"""
    tweet_id: str
    author_id: str
    content: str
    created_at: Optional[datetime] = None
    like_count: int = 0
    retweet_count: int = 0
    reply_count: int = 0
    quote_count: int = 0
    impression_count: int = 0
    language: Optional[str] = None
    conversation_id: Optional[str] = None


class XTweetResponse(BaseModel):
    tweet_id: str
    author_id: str
    content: str
    created_at: Optional[datetime]
    like_count: int
    retweet_count: int
    reply_count: int

    class Config:
        from_attributes = True


# ============ Network Stats ============

class NetworkStats(BaseModel):
    """Statistics about a user's scraped network"""
    first_degree_count: int
    profiles_indexed: int
    tweets_indexed: int
