from pydantic import BaseModel
from typing import Optional
from datetime import datetime


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
