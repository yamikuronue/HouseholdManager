#!/usr/bin/env python3
"""Generate a secure secret key for production use.

Usage:
    python scripts/generate-secret-key.py
"""

import secrets

if __name__ == "__main__":
    secret_key = secrets.token_urlsafe(32)
    print(f"Generated SECRET_KEY: {secret_key}")
    print("\nAdd this to your DigitalOcean App Platform environment variables:")
    print(f"SECRET_KEY={secret_key}")
