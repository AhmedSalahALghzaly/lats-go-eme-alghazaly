"""
Al-Ghazaly Auto Parts API - Server Entry Point
This file serves as the entry point for uvicorn and imports the modular FastAPI app.

The backend has been modularized into:
- /app/core/      - Configuration, database, security
- /app/models/    - Pydantic schemas  
- /app/services/  - Business logic (WebSocket, notifications)
- /app/api/v1/    - API endpoints organized by domain

Version: 4.1.0 - Modular Architecture
"""
from app.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
