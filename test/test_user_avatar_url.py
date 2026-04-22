"""User model: avatar_url must accept long Google profile image URLs."""


import pytest

from src.models.database import User


def test_user_can_store_very_long_avatar_url(db):
    long_url = "https://example.com/photo" + ("/" + "a" * 8) * 200  # >> 512 chars
    u = User(
        google_sub="g-sub-long-avatar",
        email="long-avatar@example.com",
        display_name="Test",
        avatar_url=long_url,
    )
    db.add(u)
    db.commit()
    db.refresh(u)

    loaded = db.get(User, u.id)
    assert loaded is not None
    assert loaded.avatar_url == long_url
