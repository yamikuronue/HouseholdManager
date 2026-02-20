"""Application configuration.

This module handles configuration from environment variables.
For DigitalOcean App Platform, set these as encrypted secrets in the console.
For local development, use a .env file (never commit this to git).
"""

import os
from typing import Optional
from pathlib import Path


class Settings:
    """Application settings loaded from environment variables.
    
    Priority order:
    1. Environment variables (production/DigitalOcean)
    2. .env file (local development)
    3. Default values (fallback)
    """
    
    def __init__(self):
        """Initialize settings, optionally loading from .env file."""
        # Try to load .env file for local development
        env_file = Path(".env")
        if env_file.exists():
            try:
                from dotenv import load_dotenv
                load_dotenv(env_file)
            except ImportError:
                # python-dotenv not installed, skip .env loading
                pass
        
        # Google OAuth
        self.GOOGLE_CLIENT_ID: Optional[str] = os.getenv("GOOGLE_CLIENT_ID")
        self.GOOGLE_CLIENT_SECRET: Optional[str] = os.getenv("GOOGLE_CLIENT_SECRET")
        self.GOOGLE_REDIRECT_URI: str = os.getenv(
            "GOOGLE_REDIRECT_URI",
            "http://localhost:8000/api/auth/callback"
        )
        
        # Database
        # For DigitalOcean: Use managed database connection string
        # Format: postgresql://user:password@host:port/dbname
        self.DATABASE_URL: str = os.getenv(
            "DATABASE_URL",
            "sqlite:///./household_manager.db"
        )
        
        # API Configuration
        self.API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
        self.API_PORT: int = int(os.getenv("API_PORT", "8000"))
        
        # Security
        # Generate a secure random key for production:
        # python -c "import secrets; print(secrets.token_urlsafe(32))"
        self.SECRET_KEY: str = os.getenv(
            "SECRET_KEY",
            "your-secret-key-change-in-production"
        )
        
        # Frontend URL
        self.FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    def validate(self) -> list[str]:
        """Validate required settings and return list of missing ones."""
        missing = []
        
        if not self.GOOGLE_CLIENT_ID:
            missing.append("GOOGLE_CLIENT_ID")
        if not self.GOOGLE_CLIENT_SECRET:
            missing.append("GOOGLE_CLIENT_SECRET")
        if not self.SECRET_KEY or self.SECRET_KEY == "your-secret-key-change-in-production":
            missing.append("SECRET_KEY (must be set in production)")
        
        return missing
    
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return os.getenv("ENVIRONMENT", "").lower() == "production" or \
               "ondigitalocean.app" in self.FRONTEND_URL or \
               "ondigitalocean.app" in self.GOOGLE_REDIRECT_URI


settings = Settings()

# Validate settings on import (warn only, don't fail)
if settings.is_production():
    missing = settings.validate()
    if missing:
        import warnings
        warnings.warn(
            f"Missing required settings in production: {', '.join(missing)}",
            UserWarning
        )
