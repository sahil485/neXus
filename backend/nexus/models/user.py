from pydantic import BaseModel, HttpUrl


class Connection(BaseModel):
    name: str
    username: str
    profile_pic: HttpUrl


class User(BaseModel):
    name: str
    username: str
    profile_pic: HttpUrl
    followers: int
    following: int
    oauth_access_token: str
