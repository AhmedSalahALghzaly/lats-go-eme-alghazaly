"""
Al-Ghazaly Auto Parts API - Modular Backend v4.1
Entry Point for FastAPI Application

This is a fully modularized backend replacing the monolithic server.py.
Structure:
- /app/core/      - Configuration, database, security
- /app/models/    - Pydantic schemas
- /app/services/  - Business logic (WebSocket, notifications)
- /app/api/v1/    - API endpoints organized by domain
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .core.database import connect_to_mongo, close_mongo_connection, create_database_indexes, seed_database, db
from .core.config import APP_VERSION
from .api.v1 import api_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown events"""
    # Startup
    logger.info(f"Starting Al-Ghazaly Auto Parts API v{APP_VERSION} - Modular Architecture")
    database = await connect_to_mongo()
    await create_database_indexes()
    
    # Seed initial data if needed
    existing_brands = await database.car_brands.count_documents({})
    if existing_brands == 0:
        logger.info("Seeding database...")
        await seed_database()
        logger.info("Database seeded successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Al-Ghazaly Auto Parts API")
    await close_mongo_connection()

# Create FastAPI application
app = FastAPI(
    title="Al-Ghazaly Auto Parts API",
    description="Professional Auto Parts Store Backend - Modular Architecture",
    version=APP_VERSION,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router)

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Al-Ghazaly Auto Parts API",
        "version": APP_VERSION,
        "architecture": "modular",
        "status": "running"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
