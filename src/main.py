"""Application entry point for running the server."""

import uvicorn
from src.config import settings
from src.db.session import init_db

if __name__ == "__main__":
    # Initialize database
    init_db()
    
    # Run the server
    uvicorn.run(
        "src.api.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True
    )
