"""
Token Bucket Rate Limiter for X API calls.

Implements the token bucket algorithm to prevent hitting API rate limits.
"""

import time
import logging
from asyncio import Lock, sleep
from random import uniform

logger = logging.getLogger(__name__)


class TokenBucketRateLimiter:
    """
    Token bucket rate limiter for X API calls.
    
    How it works:
    - Bucket holds tokens (1 token = 1 API call)
    - Tokens refill at steady rate (e.g., 1400 tokens per 15 minutes)
    - When making API call, consume 1 token
    - If no tokens available, wait until bucket refills
    
    This is better than simple counting because:
    1. Handles bursts gracefully (can accumulate tokens when idle)
    2. Smooth traffic distribution
    3. Automatically refills over time
    """
    
    def __init__(self, rate_per_second: float = 1400/900, capacity: int = 1400):
        """
        Initialize the token bucket rate limiter.
        
        Args:
            rate_per_second: How fast tokens refill (default: 1400 calls / 900 sec = ~1.56/sec)
            capacity: Max tokens in bucket (allows bursts up to this limit)
        """
        self.rate = rate_per_second
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = time.time()
        self.lock = Lock()
        
        logger.info(f"Rate limiter initialized: {rate_per_second:.2f} tokens/sec, capacity: {capacity}")
    
    async def acquire(self, tokens: int = 1):
        """
        Acquire tokens before making API call. Blocks if not enough tokens.
        
        Args:
            tokens: Number of tokens to consume (default: 1)
        """
        async with self.lock:
            now = time.time()
            
            # Refill tokens based on elapsed time
            elapsed = now - self.last_update
            self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
            self.last_update = now
            
            # If not enough tokens, wait until we have enough
            if self.tokens < tokens:
                wait_time = (tokens - self.tokens) / self.rate
                # Add jitter to prevent thundering herd
                jitter = uniform(0.1, 0.5)
                total_wait = wait_time + jitter
                
                logger.warning(
                    f"Rate limit: Only {self.tokens:.1f} tokens available, need {tokens}. "
                    f"Waiting {total_wait:.1f}s"
                )
                
                await sleep(total_wait)
                self.tokens = 0
                self.last_update = time.time()
            else:
                self.tokens -= tokens
                if self.tokens < self.capacity * 0.1:  # Less than 10% remaining
                    logger.info(f"Rate limiter: {self.tokens:.0f}/{self.capacity} tokens remaining")
    
    def get_tokens_remaining(self) -> float:
        """Get current number of tokens available (for monitoring)."""
        now = time.time()
        elapsed = now - self.last_update
        return min(self.capacity, self.tokens + elapsed * self.rate)


# Global rate limiter instance for X API
# X API limit: ~1500 requests per 15 min window (user context)
# Set to 1400 to leave safety margin
x_api_rate_limiter = TokenBucketRateLimiter(
    rate_per_second=1400 / 900,  # 1400 calls per 15 minutes
    capacity=1400
)
