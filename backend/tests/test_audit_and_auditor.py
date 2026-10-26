import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text

from app.main import app
from app.database import get_db
from app.audit.service import log_audit_event, sanitize_metadata

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def create_user_and_token(client: AsyncClient, email_prefix: str, role_id: int):
    email = f"{email_prefix}_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "StrongPassword123!"
    reg_resp = await client.post("/api/auth/register", json={
        "email": email,
        "password": pwd,
        "role_id": role_id
    })
    assert reg_resp.status_code == 201
    user_data = reg_resp.json()
    user_id = user_data.get("id") or user_data.get("data", {}).get("id")

    login_resp = await client.post("/api/auth/login", data={"username": email, "password": pwd})
    assert login_resp.status_code == 200
    token = login_resp.json().get("access_token") or login_resp.json().get("data", {}).get("access_token")
    return {"id": user_id, "email": email, "token": token}


async def test_auditor_dashboard_rbac(client: AsyncClient):
    auditor = await create_user_and_token(client, "auditor", 4)  # SECURITY_AUDITOR
    admin = await create_user_and_token(client, "admin", 1)      # ADMIN
    employee = await create_user_and_token(client, "emp", 3)     # EMPLOYEE
    owner = await create_user_and_token(client, "own", 2)        # DOCUMENT_OWNER

    # 1. Auditor can access audit events and stats
    aud_events = await client.get(
        "/api/audit/events",
        headers={"Authorization": f"Bearer {auditor['token']}"}
    )
    assert aud_events.status_code == 200
    events_data = aud_events.json().get("data") or aud_events.json()
    assert isinstance(events_data, list)

    aud_stats = await client.get(
        "/api/audit/stats",
        headers={"Authorization": f"Bearer {auditor['token']}"}
    )
    assert aud_stats.status_code == 200
    stats_data = aud_stats.json().get("data") or aud_stats.json()
    assert "total_audit_events" in stats_data
    assert "risk_distribution" in stats_data

    # 2. Admin can access audit endpoints
    admin_events = await client.get(
        "/api/audit/events",
        headers={"Authorization": f"Bearer {admin['token']}"}
    )
    assert admin_events.status_code == 200

    # 3. Employee is denied (403 Forbidden)
    emp_events = await client.get(
        "/api/audit/events",
        headers={"Authorization": f"Bearer {employee['token']}"}
    )
    assert emp_events.status_code == 403

    # 4. Document Owner is denied (403 Forbidden)
    own_events = await client.get(
        "/api/audit/events",
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert own_events.status_code == 403


async def test_audit_log_sanitization_and_exclusion_of_secrets(client: AsyncClient):
    auditor = await create_user_and_token(client, "auditor_sec", 4)

    test_request_id = uuid.uuid4()
    sensitive_metadata_input = {
        "filename": "confidential_tax_return.pdf",
        "file_size": 1024,
        "password": "CleartextPassword999!",
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitive_payload",
        "access_token": "secret_access_token_should_not_leak",
        "private_key": "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...",
        "encrypted_dek": b"\x01\x02\x03\x04\x05DEKBYTES",
        "raw_thumbnail": b"\x01\x02\x03\x04\x05",
        "otp": "654321",
        "content": "Secret document body that must never appear in log storage",
        "nested_payload": {
            "api_secret": "nested_secret_value_12345",
            "safe_description": "nested safe info"
        }
    }

    # Verify unit-level sanitizer function
    sanitized = sanitize_metadata(sensitive_metadata_input)
    assert sanitized["filename"] == "confidential_tax_return.pdf"
    assert sanitized["password"] == "[REDACTED]"
    assert sanitized["token"] == "[REDACTED]"
    assert sanitized["access_token"] == "[REDACTED]"
    assert sanitized["private_key"] == "[REDACTED]"
    assert sanitized["encrypted_dek"] == "[REDACTED]"
    assert sanitized["raw_thumbnail"] == "[BINARY: 5 bytes]"
    assert sanitized["otp"] == "[REDACTED]"
    assert sanitized["content"] == "[REDACTED]"
    assert sanitized["nested_payload"]["api_secret"] == "[REDACTED]"
    assert sanitized["nested_payload"]["safe_description"] == "nested safe info"

    # Log to real audit database via service
    async for db in get_db():
        await log_audit_event(
            db,
            action="security.test_sanitization",
            status="SUCCESS",
            user_id=auditor["id"],
            request_id=test_request_id,
            metadata=sensitive_metadata_input
        )
        await db.commit()
        break

    # Fetch audit event via API and verify database representation
    resp = await client.get(
        "/api/audit/events?action=security.test_sanitization",
        headers={"Authorization": f"Bearer {auditor['token']}"}
    )
    assert resp.status_code == 200
    events = resp.json().get("data") or resp.json()
    assert len(events) >= 1

    matching = next(e for e in events if e["request_id"] == str(test_request_id))
    meta = matching["metadata"]

    # Assert that NO cleartext secret leaked to DB or response
    assert meta["password"] == "[REDACTED]"
    assert meta["token"] == "[REDACTED]"
    assert meta["access_token"] == "[REDACTED]"
    assert meta["private_key"] == "[REDACTED]"
    assert meta["otp"] == "[REDACTED]"
    assert meta["content"] == "[REDACTED]"
    assert "CleartextPassword999!" not in str(meta)
    assert "sensitive_payload" not in str(meta)
    assert "secret_access_token" not in str(meta)
    assert "MIIEowIBAAKCAQEA0" not in str(meta)
    assert "Secret document body" not in str(meta)
    assert meta["filename"] == "confidential_tax_return.pdf"
