from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from nexus.routes import health, items, user, network, profiles, scrape, tweets, generate_rag
from nexus.db import engine
from nexus.init_db import init


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables on startup"""
    print("🚀 Starting neXus API...")
    await init()
    print("✅ Database tables initialized")
    yield
    print("👋 Shutting down neXus API...")


app = FastAPI(
    title="neXus API", 
    version="0.1.0",
    description="AI-powered social network intelligence for X/Twitter",
    lifespan=lifespan
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(items.router, prefix="/api")
app.include_router(user.router, prefix="/api")
app.include_router(profiles.router, prefix="/api")
app.include_router(network.router, prefix="/api")
app.include_router(scrape.router, prefix="/api")
app.include_router(tweets.router, prefix="/api")
app.include_router(generate_rag.router, prefix="/api/rag")

@app.get("/")
async def root():
    return {
        "message": "Welcome to neXus API",
        "docs": "/docs",
        "endpoints": {
            "users": "/api/users",
            "profiles": "/api/profiles",
            "network": "/api/network/{username}/first-degree",
            "scrape": "/api/scrape/following/{username}",
        }
    }


def start():
    import uvicorn
    uvicorn.run("nexus.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    start()
