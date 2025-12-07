import httpx
import logging
from typing import Optional, List, Dict, Union
from datetime import datetime
from asyncio import sleep
from nexus.models.x_profile import XProfileCreate
from nexus.models.x_tweet import XTweetCreate
from nexus.utils.rate_limiter import x_api_rate_limiter

logger = logging.getLogger(__name__)


class TwitterClient:
    BASE_URL = "https://api.twitter.com/2"

    USER_FIELDS = [
        "id", "name", "username", "description", "location",
        "profile_image_url", "public_metrics", "verified", "verified_type",
        "created_at", "protected"
    ]

    TWEET_FIELDS = [
        "id", "text", "created_at", "public_metrics", "conversation_id",
        "in_reply_to_user_id", "referenced_tweets", "entities", "lang"
    ]
    
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
    
    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Union[str, int]]] = None,
        max_retries: int = 3
    ) -> Dict[str, Union[str, int, List, Dict]]:
        """
        Make an HTTP request to X API with rate limiting and retry logic.
        
        Args:
            method: HTTP method
            endpoint: API endpoint
            params: Query parameters
            max_retries: Maximum number of retry attempts
        """
        url = f"{self.BASE_URL}{endpoint}"

        for attempt in range(max_retries):
            try:
                # RATE LIMITING: Acquire token before making request
                await x_api_rate_limiter.acquire()
                
                async with httpx.AsyncClient() as client:
                    response = await client.request(
                        method=method,
                        url=url,
                        headers=self.headers,
                        params=params,
                        timeout=30.0
                    )

                    # Handle 429 rate limit errors
                    if response.status_code == 429:
                        reset_time = response.headers.get("x-rate-limit-reset")
                        logger.warning(
                            f"⏱️  RATE LIMITED on {endpoint} (attempt {attempt + 1}/{max_retries}). "
                            f"Resets at: {reset_time}"
                        )
                        
                        if attempt < max_retries - 1:
                            # Wait 15 minutes before retry
                            wait_time = 900  
                            logger.info(f"Waiting {wait_time}s before retry...")
                            await sleep(wait_time)
                            continue
                        else:
                            raise Exception(f"Rate limited after {max_retries} attempts")

                    response.raise_for_status()
                    logger.debug(f"✅ Success: {method} {endpoint} (status: {response.status_code})")
                    return response.json()
                    
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    # Already handled above
                    continue
                
                logger.error(f"❌ HTTP Error {e.response.status_code} on {endpoint}: {e.response.text}")
                
                if attempt < max_retries - 1:
                    # Exponential backoff for other errors
                    wait_time = 2 ** attempt
                    logger.info(f"Retrying in {wait_time}s...")
                    await sleep(wait_time)
                    continue
                raise
                
            except httpx.TimeoutException:
                logger.error(f"⏰ Timeout on {endpoint}")
                
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.info(f"Retrying in {wait_time}s...")
                    await sleep(wait_time)
                    continue
                raise
                
            except Exception as e:
                logger.error(f"❌ Request failed on {endpoint}: {str(e)}")
                
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.info(f"Retrying in {wait_time}s...")
                    await sleep(wait_time)
                    continue
                raise
        
        raise Exception(f"Request failed after {max_retries} attempts")

    async def get_me(self) -> XProfileCreate:
        params = {"user.fields": ",".join(self.USER_FIELDS)}
        data = await self._request("GET", "/users/me", params)
        return self._parse_user(data["data"])
    
    async def get_user_by_id(self, user_id: str) -> XProfileCreate:
        params = {"user.fields": ",".join(self.USER_FIELDS)}
        data = await self._request("GET", f"/users/{user_id}", params)
        return self._parse_user(data["data"])
    
    async def get_user_by_username(self, username: str) -> XProfileCreate:
        params = {"user.fields": ",".join(self.USER_FIELDS)}
        data = await self._request("GET", f"/users/by/username/{username}", params)
        return self._parse_user(data["data"])
    
    async def get_users_batch(self, user_ids: List[str]) -> List[XProfileCreate]:
        if len(user_ids) > 100:
            raise ValueError("Maximum 100 user IDs per request")
        
        params = {
            "ids": ",".join(user_ids),
            "user.fields": ",".join(self.USER_FIELDS)
        }
        data = await self._request("GET", "/users", params)
        
        users = []
        for user_data in data.get("data", []):
            users.append(self._parse_user(user_data))
        return users

    async def get_following(
        self,
        user_id: str,
        max_results: int = 10,
        pagination_token: Optional[str] = None
    ) -> Dict[str, Union[List[XProfileCreate], Optional[str]]]:
        params = {
            "user.fields": ",".join(self.USER_FIELDS),
            "max_results": min(max_results, 1000),
        }
        if pagination_token:
            params["pagination_token"] = pagination_token
        
        data = await self._request("GET", f"/users/{user_id}/following", params)
        
        users = []
        for user_data in data.get("data", []):
            users.append(self._parse_user(user_data))
        
        next_token = data.get("meta", {}).get("next_token")
        
        return {"users": users, "next_token": next_token}
    
    async def get_followers(
        self,
        user_id: str,
        max_results: int = 10,
        pagination_token: Optional[str] = None
    ) -> Dict[str, Union[List[XProfileCreate], Optional[str]]]:
        params = {
            "user.fields": ",".join(self.USER_FIELDS),
            "max_results": min(max_results, 1000),
        }
        if pagination_token:
            params["pagination_token"] = pagination_token
        
        data = await self._request("GET", f"/users/{user_id}/followers", params)
        
        users = []
        for user_data in data.get("data", []):
            users.append(self._parse_user(user_data))
        
        next_token = data.get("meta", {}).get("next_token")
        
        return {"users": users, "next_token": next_token}
    
    async def get_all_following(self, user_id: str, max_results: Optional[int] = None) -> List[XProfileCreate]:
        if max_results:
            result = await self.get_following(user_id, max_results=max_results)
            return result["users"]

        all_users = []
        next_token = None

        while True:
            result = await self.get_following(user_id, pagination_token=next_token)
            all_users.extend(result["users"])
            next_token = result["next_token"]

            if not next_token:
                break

        return all_users
    
    async def get_all_followers(self, user_id: str, max_results: Optional[int] = None) -> List[XProfileCreate]:
        if max_results:
            result = await self.get_followers(user_id, max_results=max_results)
            return result["users"]

        all_users = []
        next_token = None

        while True:
            result = await self.get_followers(user_id, pagination_token=next_token)
            all_users.extend(result["users"])
            next_token = result["next_token"]

            if not next_token:
                break

        return all_users

    async def get_user_tweets(
        self,
        user_id: str,
        max_results: int = 100,
        pagination_token: Optional[str] = None
    ) -> Dict[str, Union[List[XTweetCreate], Optional[str]]]:
        params = {
            "tweet.fields": ",".join(self.TWEET_FIELDS),
            "max_results": min(max_results, 100),
            "exclude": "retweets,replies",
        }
        if pagination_token:
            params["pagination_token"] = pagination_token
        
        data = await self._request("GET", f"/users/{user_id}/tweets", params)
        
        tweets = []
        for tweet_data in data.get("data", []):
            tweets.append(self._parse_tweet(tweet_data, user_id))
        
        next_token = data.get("meta", {}).get("next_token")
        
        return {"tweets": tweets, "next_token": next_token}
    
    async def get_user_tweets_batch(
        self,
        user_id: str,
        count: int = 50
    ) -> List[XTweetCreate]:
        try:
            next_token = None
            result = await self.get_user_tweets(
                user_id,
                max_results=count,
                pagination_token=next_token
            )
            return result["tweets"]
        except Exception:
            return []

    async def get_user_posts_text(self, user_id: str, count: int = 50) -> List[str]:
        """Get just the text content of a user's posts as a list of strings"""
        tweets = await self.get_user_tweets_batch(user_id, count)
        return [tweet.content for tweet in tweets]

    def _parse_user(self, data: Dict[str, Union[str, int, bool, Dict[str, int]]]) -> XProfileCreate:
        metrics = data.get("public_metrics", {})
        
        created_at = None
        if data.get("created_at"):
            try:
                created_at = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
            except:
                pass
        
        return XProfileCreate(
            x_user_id=data["id"],
            username=data["username"],
            name=data.get("name"),
            bio=data.get("description"),
            location=data.get("location"),
            profile_image_url=data.get("profile_image_url"),
            verified=data.get("verified", False) or data.get("verified_type") is not None,
            followers_count=metrics.get("followers_count", 0),
            following_count=metrics.get("following_count", 0),
            tweet_count=metrics.get("tweet_count", 0),
            listed_count=metrics.get("listed_count", 0),
            is_protected=data.get("protected", False),
            account_created_at=created_at,
        )
    
    def _parse_tweet(self, data: Dict[str, Union[str, int, Dict[str, int]]], author_id: str) -> XTweetCreate:
        metrics = data.get("public_metrics", {})
        
        created_at = None
        if data.get("created_at"):
            try:
                created_at = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
            except:
                pass
        
        return XTweetCreate(
            tweet_id=data["id"],
            author_id=author_id,
            content=data.get("text", ""),
            created_at=created_at,
            like_count=metrics.get("like_count", 0),
            retweet_count=metrics.get("retweet_count", 0),
            reply_count=metrics.get("reply_count", 0),
            quote_count=metrics.get("quote_count", 0),
            impression_count=metrics.get("impression_count", 0),
            language=data.get("lang"),
            conversation_id=data.get("conversation_id"),
        )
