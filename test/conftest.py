# Use a separate SQLite DB for tests so dev data is not touched.
# Set TEST_DATABASE_URL in env to override the default below.
import os

os.environ["DATABASE_URL"] = os.getenv(
    "TEST_DATABASE_URL", "sqlite:///./household_manager_test.db"
)

import pytest
from src.db.session import SessionLocal, init_db


@pytest.fixture(scope="session")
def db_engine():
    """Create tables once per test session."""
    init_db()
    yield


@pytest.fixture
def db(db_engine):
    """Fresh database session per test; roll back after each test."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
