import pytest
from httpx import AsyncClient, ASGITransport
import uuid
import jwt
from app.config import settings
from app.main import app

pytestmark = pytest.mark.asyncio

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

def get_unique_email(prefix="test"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"

async def test_register_success(client: AsyncClient):
    email = get_unique_email("reg")
    response = await client.post("/api/auth/register", json={
        "email": email,
        "password": "SuperSecretPassword123!"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == email
    assert "password_hash" not in data
    assert "id" in data

async def test_register_duplicate(client: AsyncClient):
    email = get_unique_email("dup")
    await client.post("/api/auth/register", json={"email": email, "password": "SuperSecretPassword123!"})
    response = await client.post("/api/auth/register", json={"email": email, "password": "SuperSecretPassword123!"})
    assert response.status_code == 409

async def test_register_weak_password(client: AsyncClient):
    response = await client.post("/api/auth/register", json={
        "email": get_unique_email("weak"),
        "password": "short"
    })
    assert response.status_code == 422
    
    response = await client.post("/api/auth/register", json={
        "email": get_unique_email("space"),
        "password": "            "
    })
    assert response.status_code == 422

async def test_login_success(client: AsyncClient):
    email = get_unique_email("login")
    await client.post("/api/auth/register", json={"email": email, "password": "SuperSecretPassword123!"})
    response = await client.post("/api/auth/login", data={
        "username": email,
        "password": "SuperSecretPassword123!"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    
    token = data["access_token"]
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    assert "sub" in payload
    assert "jti" in payload
    assert "iat" in payload
    assert "exp" in payload
    assert payload["type"] == "access"

async def test_login_incorrect_password(client: AsyncClient):
    email = get_unique_email("badpass")
    await client.post("/api/auth/register", json={"email": email, "password": "SuperSecretPassword123!"})
    response = await client.post("/api/auth/login", data={
        "username": email,
        "password": "WrongPassword!"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"

async def test_login_nonexistent_user(client: AsyncClient):
    response = await client.post("/api/auth/login", data={
        "username": "nobody@example.com",
        "password": "SuperSecretPassword123!"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"

async def test_protected_route_and_logout(client: AsyncClient):
    email = get_unique_email("logout")
    await client.post("/api/auth/register", json={"email": email, "password": "SuperSecretPassword123!"})
    
    # Login session 1
    resp1 = await client.post("/api/auth/login", data={"username": email, "password": "SuperSecretPassword123!"})
    token1 = resp1.json()["access_token"]
    
    # Login session 2
    resp2 = await client.post("/api/auth/login", data={"username": email, "password": "SuperSecretPassword123!"})
    token2 = resp2.json()["access_token"]
    
    # Access /me with token1
    me_resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token1}"})
    assert me_resp.status_code == 200
    
    # Logout session 1
    logout_resp = await client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token1}"})
    assert logout_resp.status_code == 204
    
    # Access /me with token1 should fail
    me_resp_after = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token1}"})
    assert me_resp_after.status_code == 401
    
    # Access /me with token2 should succeed
    me_resp_token2 = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token2}"})
    assert me_resp_token2.status_code == 200

async def test_invalid_jwt(client: AsyncClient):
    me_resp = await client.get("/api/auth/me", headers={"Authorization": "Bearer badtoken.xyz"})
    assert me_resp.status_code == 401
