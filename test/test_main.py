"""Tests for main app routes: health, robots.txt."""

import pytest
from fastapi.testclient import TestClient

from src.api.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_returns_200(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "healthy"}


def test_robots_txt_returns_200_and_plain_text(client):
    r = client.get("/robots.txt")
    assert r.status_code == 200
    assert "text/plain" in r.headers.get("content-type", "")
    body = r.text
    assert "User-agent:" in body
    assert "Allow: /" in body
    assert "Disallow: /api/" in body
