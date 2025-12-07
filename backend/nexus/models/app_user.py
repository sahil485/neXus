from pydantic import BaseModel, HttpUrl
from typing import Optional


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
