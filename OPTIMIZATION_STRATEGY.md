# neXus API Optimization Strategy

## 🚨 Critical Efficiency Issues

### 1. **No Staleness Checks - Redundant API Calls**
**Current Problem:**
- Every scrape hits X API even if data was fetched 5 minutes ago
- No TTL (time-to-live) logic on cached data
- `last_updated_at` field exists but is never checked before re-fetching

**Impact:** 
- Wasted API calls (X charges per request)
- Unnecessary rate limit consumption
- Slow response times

**Solution:**
```python
# Add staleness check before scraping
PROFILE_TTL = 86400  # 24 hours in seconds
CONNECTION_TTL = 604800  # 7 days

async def should_refresh_profile(profile: XProfile) -> bool:
    if not profile.last_updated_at:
        return True
    age = (datetime.utcnow() - profile.last_updated_at).total_seconds()
    return age > PROFILE_TTL

async def should_refresh_connections(user_id: str, db: AsyncSession) -> bool:
    connection = await db.get(XConnection, user_id)
    if not connection:
        return True
    age = (datetime.utcnow() - connection.discovered_at).total_seconds()
    return age > CONNECTION_TTL
```

---

### 2. **Massive Over-Fetching - 2nd Degree Explosion**
**Current Problem:**
- Scraping 2nd degree = (1st degree count) × (their mutual count)
- For a user with 500 mutuals, could be 500 × 500 = 250,000 profiles!
- `scrape_connections()` fetches ALL 2nd degree connections in parallel batches

**Impact:**
- 1000s of API calls in one operation
- Rate limit exhaustion
- 10+ minute scrape times
- Database bloat

**Solution:**
```python
# Option 1: Limit 2nd degree to top N most relevant
MAX_SECOND_DEGREE = 500  # Per user, not total

# Option 2: Lazy loading - only fetch 2nd degree when user views them
# Store connection exists, but don't fetch full profile until needed

# Option 3: Sample-based approach
SAMPLE_FIRST_DEGREE_FOR_SECOND = 50  # Only expand 50 1st degree connections
```

---

### 3. **Posts Scraping is Unbounded**
**Current Problem:**
- `scrape_posts_for_user_network()` scrapes 50 tweets × ALL connections
- No prioritization - treats everyone equally
- Runs synchronously through entire network

**Impact:**
- If you have 1000 connections = 50,000 tweets = 1000 API calls
- X API rate limit: 1500 calls per 15 min window (user context)
- This WILL rate limit on medium-sized networks

**Solution:**
```python
# Prioritize posts scraping
class ProfilePriority:
    HIGH = 1    # 1st degree, high engagement
    MEDIUM = 2  # 1st degree, low engagement
    LOW = 3     # 2nd degree
    
# Only scrape posts for HIGH priority profiles initially
# Lazy-load MEDIUM/LOW when user explicitly views them

async def should_scrape_posts(profile: XProfile) -> bool:
    # Don't scrape if posts were fetched recently
    posts = await db.get(XPosts, profile.x_user_id)
    if posts:
        age = (datetime.utcnow() - posts.discovered_at).total_seconds()
        if age < 86400:  # 24 hours
            return False
    
    # Don't scrape protected accounts (wastes API call)
    if profile.is_protected:
        return False
    
    # Don't scrape low-follower accounts (less valuable signal)
    if profile.followers_count < 100:
        return False
        
    return True
```

---

### 4. **No Rate Limit Protection**
**Current Problem:**
- Parallel batches of 5 with no backoff
- No rate limit error handling
- No request throttling

**Impact:**
- Hits rate limits quickly
- Gets 429 errors
- Has to wait 15 minutes before continuing

**Why NOT to use Semaphore:**
```python
# ❌ WRONG - This limits CONCURRENCY, not RATE
semaphore = Semaphore(1400)  # Allows 1400 concurrent calls
await semaphore.acquire()    # Blocks after 1400 simultaneous calls
# Problem: Doesn't track time windows, just "how many at once"
```

**Solution (Token Bucket Algorithm):**
```python
import time
from asyncio import Lock, sleep
from random import uniform

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
    def __init__(self, rate_per_second=1400/900, capacity=1400):
        """
        Args:
            rate_per_second: How fast tokens refill (1400 calls / 900 sec = ~1.56/sec)
            capacity: Max tokens in bucket (allows bursts up to this limit)
        """
        self.rate = rate_per_second
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = time.time()
        self.lock = Lock()
    
    async def acquire(self, tokens=1):
        """Acquire tokens before making API call. Blocks if not enough tokens."""
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
                wait_time += uniform(0.1, 0.5)
                await sleep(wait_time)
                self.tokens = 0
                self.last_update = time.time()
            else:
                self.tokens -= tokens

# Global rate limiter instance
# X API limit: ~1500 requests per 15 min window (user context)
# Set to 1400 to leave safety margin
rate_limiter = TokenBucketRateLimiter(
    rate_per_second=1400/900,  # 1400 calls per 15 minutes
    capacity=1400
)

async def api_call_with_retry(func, *args, max_retries=3):
    """Wrapper for API calls with automatic rate limiting and retry logic"""
    for attempt in range(max_retries):
        try:
            # Wait for rate limit token
            await rate_limiter.acquire()
            
            # Make the API call
            return await func(*args)
            
        except RateLimitError as e:
            if attempt == max_retries - 1:
                raise
            # If we hit 429, wait full reset period
            wait_time = 900  # 15 minutes
            logger.warning(f"Rate limited (429). Waiting {wait_time}s before retry")
            await sleep(wait_time)
            
        except Exception as e:
            logger.error(f"API call failed: {e}")
            if attempt == max_retries - 1:
                raise
            # Exponential backoff for other errors
            await sleep(2 ** attempt)
```

---

### 5. **Embeddings Generation is Expensive**
**Current Problem:**
- Generates embeddings for EVERY profile immediately after scraping
- Uses Grok ($5/1M tokens) + Gemini (free but rate-limited)
- Synchronous blocking operation

**Impact:**
- Adds 30+ seconds to scrape time
- Costs money on Grok API
- Unnecessary for profiles user may never view

**Solution:**
```python
# Option 1: Background job queue (Celery/Inngest)
# Generate embeddings async, don't block scrape

# Option 2: Lazy generation - only when needed
async def get_profile_with_embedding(user_id: str, db: AsyncSession):
    profile = await db.get(XProfile, user_id)
    
    # Generate on-demand if missing
    if not profile.embedding:
        background_tasks.add_task(generate_embedding, profile)
    
    return profile

# Option 3: Batch nightly job
# Run embedding generation overnight for all profiles without embeddings
# During peak hours, just scrape profiles - no embeddings
```

---

### 6. **No Differential Updates**
**Current Problem:**
- Always does full refresh of following list
- Re-fetches all mutual connections even if only 1 changed

**Impact:**
- Waste API calls on unchanged data
- Slow updates

**Solution:**
```python
# Track what changed since last scrape
async def differential_scrape(user_id: str, db: AsyncSession):
    # Get current mutual_ids from DB
    old_connection = await db.get(XConnection, user_id)
    old_mutuals = set(old_connection.mutual_ids) if old_connection else set()
    
    # Fetch new mutual list from X (1 API call)
    new_mutuals = await client.get_all_following(user_id)
    new_mutual_ids = {p.x_user_id for p in new_mutuals}
    
    # Only fetch FULL profile data for NEW mutuals
    added = new_mutual_ids - old_mutuals
    removed = old_mutuals - new_mutual_ids
    
    logger.info(f"Differential update: +{len(added)} -{len(removed)}")
    
    # Only scrape NEW profiles (major savings!)
    for user_id in added:
        profile = await client.get_user(user_id)
        # ... save to DB
```

---

### 7. **Database Query Inefficiency**
**Current Problem:**
- Fetching profiles in loops instead of bulk queries
- No query result caching
- Loading entire `posts` array when only need count

**Solution:**
```python
# Bad: N+1 query problem
for mutual_id in mutual_ids:
    profile = await db.get(XProfile, mutual_id)
    
# Good: Bulk query
profiles = await db.execute(
    select(XProfile).where(XProfile.x_user_id.in_(mutual_ids))
)

# Add Redis caching for hot data
@cached(ttl=3600, key="user_network:{user_id}")
async def get_user_network(user_id: str):
    # ...
```

---

### 8. **No Request Deduplication**
**Current Problem:**
- If 2 users both follow the same person, we scrape that person twice
- No job queue to merge duplicate scrape requests

**Solution:**
```python
# Use background job queue with deduplication
from inngest import Inngest

@inngest.create_function(
    fn_id="scrape-profile",
    retries=3,
    debounce={"key": "event.data.user_id", "period": "1h"}  # Only once per hour
)
async def scrape_profile(event):
    user_id = event.data.user_id
    # ...
```

---

## 📊 Priority Optimization Roadmap

### Phase 1: Quick Wins (Immediate - Low Effort, High Impact)
1. ✅ Add staleness checks (1 hour)
   - Check `last_updated_at` before scraping
   - Skip profiles updated in last 24h
   
2. ✅ Limit 2nd degree expansion (1 hour)
   - Cap at 100 2nd degree profiles per user
   - Or sample 20% of 1st degree for expansion
   
3. ✅ Skip protected accounts (30 min)
   - Don't waste API calls on profiles we can't access
   
4. ✅ Add request throttling (2 hours)
   - Simple delay between requests
   - Exponential backoff on rate limit errors

**Expected Savings: 60-80% reduction in API calls**

---

### Phase 2: Medium Optimizations (1-2 days)
5. ⏳ Lazy-load posts and embeddings
   - Don't generate embeddings during scrape
   - Fetch posts only when user views profile
   
6. ⏳ Differential scraping
   - Only fetch changed connections
   - Track deltas, not full refreshes
   
7. ⏳ Priority-based scraping
   - High priority: 1st degree, high engagement
   - Low priority: 2nd degree, low followers

**Expected Savings: Additional 40% API call reduction, 5x faster scrapes**

---

### Phase 3: Infrastructure (1 week)
8. 🔄 Background job queue (Inngest)
   - Move embeddings to async jobs
   - Deduplication of scrape requests
   
9. 🔄 Redis caching layer
   - Cache frequently accessed data
   - Reduce database load
   
10. 🔄 Webhook-based updates
    - Use X webhooks for real-time updates
    - No polling needed

**Expected Savings: 90% reduction from baseline, near-instant responses**

---

## 💰 Cost Analysis

### Current State (Worst Case)
- User with 500 mutuals
- Scraping 1st + 2nd degree: ~25,000 profiles
- Posts: 50 tweets × 500 = 25,000 tweets
- **Total X API calls: ~50,000 per full scrape**
- **Cost:** ~$500/month per 1000 users (estimating $0.50 per 1000 calls)

### After Phase 1 Optimizations
- Staleness checks reduce calls by 70%
- 2nd degree limit: 100 profiles instead of 25,000
- **Total X API calls: ~600 per scrape**
- **Cost:** ~$6/month per 1000 users
- **Savings: 98%**

### After Phase 3
- Differential updates: only changed data
- Lazy loading: only what's viewed
- **Total X API calls: ~50 per scrape (incremental)**
- **Cost:** ~$0.50/month per 1000 users
- **Savings: 99.9%**

---

## 🎯 Recommended Immediate Actions

1. **Add this to `scraper.py`:**
```python
PROFILE_FRESHNESS_HOURS = 24
POSTS_FRESHNESS_HOURS = 24
MAX_SECOND_DEGREE = 100

async def is_stale(timestamp: datetime, max_age_hours: int) -> bool:
    if not timestamp:
        return True
    age_hours = (datetime.utcnow() - timestamp).total_seconds() / 3600
    return age_hours > max_age_hours
```

2. **Modify `scrape_connections()`:**
```python
# Before scraping 2nd degree
second_degree_mutuals = []
sampled_mutuals = connections_data["mutual"][:MAX_SECOND_DEGREE]  # Limit!

for mutual in sampled_mutuals:
    # Add staleness check
    if not await is_stale(mutual.last_updated_at, PROFILE_FRESHNESS_HOURS):
        logger.info(f"Skipping fresh profile @{mutual.username}")
        continue
    # ... rest of logic
```

3. **Add to `scrape_posts_for_profiles()`:**
```python
# Skip if posts are fresh
existing_posts = await db.get(XPosts, profile.x_user_id)
if existing_posts and not await is_stale(existing_posts.discovered_at, POSTS_FRESHNESS_HOURS):
    logger.info(f"Skipping fresh posts for @{profile.username}")
    continue
```

---

## 📚 Technical Deep Dive: Rate Limiting Concepts

### Semaphore vs Token Bucket vs Sliding Window

| Approach | What It Limits | Use Case | Threading Model |
|----------|---------------|----------|-----------------|
| **Semaphore** | Concurrent access | Database connection pools, resource locks | Async (coroutines) or threaded |
| **Token Bucket** | Rate over time | API rate limiting with burst tolerance | Async (single-threaded event loop) |
| **Sliding Window** | Rate over time | Strict rate limiting, no bursts | Async (single-threaded event loop) |

### Why Semaphore Fails for Rate Limiting:

```python
# Semaphore example
sem = Semaphore(1400)

# First 1400 calls
for i in range(1400):
    await sem.acquire()  # ✅ Works fine
    api_call()

# Call 1401
await sem.acquire()  # ❌ BLOCKS FOREVER (no one calls release())

# Even if you call release():
sem.release()  # Now counter = 1401/1400 (counter can exceed limit!)
```

**Key Problem:** Semaphores don't understand TIME. They just count "how many are currently happening."

### Token Bucket Visualization:

```
Time:  0s    5s    10s   15s   20s
       |-----|-----|-----|-----|
       
Bucket: [████████████████] 1400 tokens (full)
Call 1: [███████████████ ] 1399 tokens
Call 2: [██████████████  ] 1398 tokens
...
(burst of 1400 calls in 1 second)
Bucket: [                ] 0 tokens

Wait 5s...
Refill: [█               ] ~8 tokens (1.56/sec × 5sec)

Call:   [                ] 0 tokens (consumed 1)
Wait:   [                ] Must wait ~0.64s for next token
```

### Async vs Multithreaded:

**Python's asyncio is NOT multithreaded:**
- Single Python interpreter thread
- Event loop juggles many coroutines
- Think: "1 chef handling 1000 orders by context switching"
- `asyncio.Lock` ensures coroutines don't corrupt shared state

**If you need true multithreading:**
```python
import threading

# Use threading.Semaphore instead of asyncio.Semaphore
thread_safe_limiter = threading.Semaphore(10)

def threaded_function():
    with thread_safe_limiter:
        # ... do work
```

But for API calls, async is better:
- Lower memory overhead (coroutines vs threads)
- Better for I/O-bound work (waiting for network responses)
- Python GIL makes multithreading inefficient for I/O anyway

---

Would you like me to implement these Phase 1 optimizations now?
