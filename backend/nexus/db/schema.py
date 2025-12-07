from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Text, Boolean, BigInteger, ForeignKey, UniqueConstraint
from datetime import datetime
from typing import Optional


class Base(DeclarativeBase):
    pass


# ============ App Users (OAuth'd users of YOUR app) ============

class UserDb(Base):
    """App users - people who OAuth with our app"""
    __tablename__ = "users"

    x_user_id: Mapped[str] = mapped_column(String(50), primary_key=True)  # Twitter's user ID
    name: Mapped[str]
    username: Mapped[str] = mapped_column(unique=True, index=True)
    profile_pic: Mapped[str]
    followers: Mapped[int]
    following: Mapped[int]
    oauth_access_token: Mapped[str]
    last_scraped_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)


# ============ X Profiles (ALL Twitter users, global/shared) ============

class XProfile(Base):
    """All Twitter users we've ever encountered (global, shared)"""
    __tablename__ = "x_profiles"

    x_user_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    username: Mapped[str] = mapped_column(String(50), index=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    profile_image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    followers_count: Mapped[int] = mapped_column(BigInteger, default=0)
    following_count: Mapped[int] = mapped_column(BigInteger, default=0)
    tweet_count: Mapped[int] = mapped_column(BigInteger, default=0)
    listed_count: Mapped[int] = mapped_column(BigInteger, default=0)
    is_protected: Mapped[bool] = mapped_column(Boolean, default=False)
    account_created_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    last_updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


# ============ X Follows (The Graph - who follows whom) ============

class XFollow(Base):
    """Twitter's follow graph - who follows whom (global, shared)"""
    __tablename__ = "x_follows"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    follower_id: Mapped[str] = mapped_column(String(50), ForeignKey("x_profiles.x_user_id"), index=True)
    following_id: Mapped[str] = mapped_column(String(50), ForeignKey("x_profiles.x_user_id"), index=True)
    discovered_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('follower_id', 'following_id', name='uq_follow_edge'),
    )


# ============ X Tweets (For content analysis) ============

class XTweet(Base):
    """Tweets for content analysis (global, shared)"""
    __tablename__ = "x_tweets"

    tweet_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    author_id: Mapped[str] = mapped_column(String(50), ForeignKey("x_profiles.x_user_id"), index=True)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    like_count: Mapped[int] = mapped_column(BigInteger, default=0)
    retweet_count: Mapped[int] = mapped_column(BigInteger, default=0)
    reply_count: Mapped[int] = mapped_column(BigInteger, default=0)
    quote_count: Mapped[int] = mapped_column(BigInteger, default=0)
    impression_count: Mapped[int] = mapped_column(BigInteger, default=0)
    language: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    conversation_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
