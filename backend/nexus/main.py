from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from nexus.routes import health, items, followers
from nexus.db import engine

app = FastAPI(title="neXus API", version="0.1.0")

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(items.router, prefix="/api")
app.include_router(followers.router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Welcome to neXus API"}


def start():
    import uvicorn
    uvicorn.run("nexus.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    start()
