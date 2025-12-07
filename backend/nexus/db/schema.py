from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Text, Boolean, BigInteger, ForeignKey, UniqueConstraint, ARRAY
from pgvector.sqlalchemy import Vector
from datetime import datetime
from typing import Optional, List


class Base(DeclarativeBase):
    pass


# ============ App Users (OAuth'd users of YOUR app) ============

class UserDb(Base):
    """App users - people who OAuth with our app"""
    __tablename__ = "users"

    x_user_id: Mapped[str] = mapped_column(String(50), primary_key=True) 
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
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True) 
    embedding = mapped_column(Vector(768), nullable=True) 


# ============ X Follows (The Graph - who follows whom) ============

class XConnection(Base):
    """Twitter's follow graph - stores mutual connections as array"""
    __tablename__ = "x_connections"

    x_user_id: Mapped[str] = mapped_column(String(50), ForeignKey("x_profiles.x_user_id"), primary_key=True)
    mutual_ids: Mapped[List[str]] = mapped_column(ARRAY(String(50)), default=list)
    discovered_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


# ============ X Posts (Simple posts storage - array of strings) ============

class XPosts(Base):
    """Simplified posts storage - just the text content as array"""
    __tablename__ = "x_posts"

    x_user_id: Mapped[str] = mapped_column(String(50), ForeignKey("x_profiles.x_user_id"), primary_key=True)
    posts: Mapped[List[str]] = mapped_column(ARRAY(Text), default=list)
    discovered_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
