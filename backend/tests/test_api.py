import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set db url to sqlite memory before importing app
os.environ["STORYFORGE_DB_URL"] = "sqlite:///:memory:"

from backend.app.main import app
from backend.app.db import Base, get_db

from sqlalchemy.pool import StaticPool

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def client():
    # Create tables
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    # Drop tables
    Base.metadata.drop_all(bind=engine)

def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}

def test_auth_signup_login(client):
    # Signup
    email = "test@example.com"
    password = "securepassword123"

    response = client.post("/api/auth/signup", json={"email": email, "password": password})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data

    # Login
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    assert "access_token" in response.json()
    token = response.json()["access_token"]

    # Me
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == email

def test_auth_invalid_login(client):
    response = client.post("/api/auth/login", json={"email": "wrong@example.com", "password": "wrong"})
    assert response.status_code == 401

def test_stories_empty(client):
    # Login to get token
    email = "story@example.com"
    password = "password123"
    client.post("/api/auth/signup", json={"email": email, "password": password})
    token = client.post("/api/auth/login", json={"email": email, "password": password}).json()["access_token"]

    response = client.get("/api/stories", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == []

def test_create_and_get_story(client):
    # Login
    email = "writer@example.com"
    password = "password123"
    client.post("/api/auth/signup", json={"email": email, "password": password})
    token = client.post("/api/auth/login", json={"email": email, "password": password}).json()["access_token"]

    story_data = {
        "id": "story123",
        "title": "My Epic Story",
        "genre": "Fantasy",
        "tone": "Epic",
        "config": {"prompt": "A hero rises"},
        "blueprint": {"chapters": []},
        "storyContent": {},
        "storyImages": {}
    }

    # Upsert
    response = client.post("/api/stories", json=story_data, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["title"] == "My Epic Story"

    # List
    response = client.get("/api/stories", headers={"Authorization": f"Bearer {token}"})
    assert len(response.json()) == 1

    # Get Detail
    response = client.get(f"/api/stories/{story_data['id']}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["title"] == "My Epic Story"
    assert response.json()["config"]["prompt"] == "A hero rises"

def test_delete_story(client):
    email = "deleter@example.com"
    password = "password123"
    client.post("/api/auth/signup", json={"email": email, "password": password})
    token = client.post("/api/auth/login", json={"email": email, "password": password}).json()["access_token"]

    # Create
    story_data = {"id": "del123", "title": "To Delete"}
    client.post("/api/stories", json=story_data, headers={"Authorization": f"Bearer {token}"})

    # Delete
    response = client.delete("/api/stories/del123", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    # Verify gone
    response = client.get("/api/stories/del123", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 404
