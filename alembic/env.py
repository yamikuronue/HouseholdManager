"""Alembic environment. Uses DATABASE_URL and src.models.database.Base."""

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.models.database import Base

config = context.config()
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Use DATABASE_URL from environment (same as app)
database_url = os.getenv("DATABASE_URL", "sqlite:///./household_manager.db")
# SQLite: ensure check_same_thread is False for async
connect_args = {}
if "sqlite" in database_url:
    connect_args["check_same_thread"] = False

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generate SQL only)."""
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connect to DB)."""
    engine = create_engine(database_url, connect_args=connect_args)
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
