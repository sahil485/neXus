from fastapi import FastAPI
from nexus.routes import health, items
from nexus.db import engine

app = FastAPI(title="neXus API", version="0.1.0")

# Include routers
app.include_router(health.router)
app.include_router(items.router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Welcome to neXus API"}


def start():
    import uvicorn
    uvicorn.run("nexus.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    start()
