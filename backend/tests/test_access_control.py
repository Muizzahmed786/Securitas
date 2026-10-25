import uuid
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text

from app.main import app
from app.database import get_db

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


async def test_rbac_denial_for_unauthorized_roles(client: AsyncClient):
    # Role 3 is EMPLOYEE: does not have documents.upload permission
    employee = await create_user_and_token(client, "employee", 3)
    pdf_content = b"%PDF-1.4\nEmployee attempt to upload\n%%EOF"

    resp = await client.post(
        "/api/documents/upload",
        files={"file": ("unauthorized.pdf", pdf_content, "application/pdf")},
        data={"classification": "INTERNAL"},
        headers={"Authorization": f"Bearer {employee['token']}"}
    )
    assert resp.status_code == 403


async def test_unauthorized_document_access(client: AsyncClient):
    owner = await create_user_and_token(client, "owner", 2)
    other_user = await create_user_and_token(client, "stranger", 2)

    # Owner uploads document
    pdf_content = b"%PDF-1.4\nConfidential Data\n%%EOF"
    up_resp = await client.post(
        "/api/documents/upload",
        files={"file": ("secret.pdf", pdf_content, "application/pdf")},
        data={"classification": "INTERNAL"},
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert up_resp.status_code == 201
    doc_id = up_resp.json().get("id") or up_resp.json().get("data", {}).get("id")

    # Stranger attempts to fetch metadata -> 404 (document not found or access denied)
    meta_resp = await client.get(
        f"/api/documents/{doc_id}",
        headers={"Authorization": f"Bearer {other_user['token']}"}
    )
    assert meta_resp.status_code == 404

    # Stranger attempts to download -> 404
    down_resp = await client.get(
        f"/api/documents/{doc_id}/download",
        headers={"Authorization": f"Bearer {other_user['token']}"}
    )
    assert down_resp.status_code == 404


async def test_sharing_permissions_and_revocation(client: AsyncClient):
    owner = await create_user_and_token(client, "owner_share", 2)
    recipient = await create_user_and_token(client, "recipient_share", 3)

    pdf_content = b"%PDF-1.4\nShared content to verify RBAC and Revocation\n%%EOF"
    up_resp = await client.post(
        "/api/documents/upload",
        files={"file": ("shared.pdf", pdf_content, "application/pdf")},
        data={"classification": "INTERNAL"},
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    doc_id = up_resp.json().get("id") or up_resp.json().get("data", {}).get("id")

    # 1. Share with READ only permission
    share_resp = await client.post(
        f"/api/documents/{doc_id}/share",
        json={
            "recipient_email": recipient["email"],
            "permission": "READ"
        },
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert share_resp.status_code == 201

    # Recipient can read metadata
    meta_resp = await client.get(
        f"/api/documents/{doc_id}",
        headers={"Authorization": f"Bearer {recipient['token']}"}
    )
    assert meta_resp.status_code == 200

    # Recipient CANNOT download with READ-only permission -> 403
    down_resp = await client.get(
        f"/api/documents/{doc_id}/download",
        headers={"Authorization": f"Bearer {recipient['token']}"}
    )
    assert down_resp.status_code == 403
    assert "only permits READ" in down_resp.json().get("message", "")

    # 2. Upgrade to DOWNLOAD permission
    upgrade_resp = await client.post(
        f"/api/documents/{doc_id}/share",
        json={
            "recipient_email": recipient["email"],
            "permission": "DOWNLOAD"
        },
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert upgrade_resp.status_code == 201

    # Recipient can now download
    down_ok = await client.get(
        f"/api/documents/{doc_id}/download",
        headers={"Authorization": f"Bearer {recipient['token']}"}
    )
    assert down_ok.status_code == 200
    assert down_ok.content == pdf_content

    # 3. Revoke access
    revoke_resp = await client.post(
        f"/api/documents/{doc_id}/revoke",
        json={"user_id": recipient["id"]},
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert revoke_resp.status_code == 200

    # Direct download must now fail with 403 revoked
    down_revoked = await client.get(
        f"/api/documents/{doc_id}/download",
        headers={"Authorization": f"Bearer {recipient['token']}"}
    )
    assert down_revoked.status_code == 403
    assert "revoked" in down_revoked.json().get("message", "").lower()


async def test_expired_sharing_access_rejection(client: AsyncClient):
    owner = await create_user_and_token(client, "owner_exp", 2)
    recipient = await create_user_and_token(client, "recipient_exp", 3)

    pdf_content = b"%PDF-1.4\nExpiring sensitive content\n%%EOF"
    up_resp = await client.post(
        "/api/documents/upload",
        files={"file": ("expiring.pdf", pdf_content, "application/pdf")},
        data={"classification": "INTERNAL"},
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    doc_id = up_resp.json().get("id") or up_resp.json().get("data", {}).get("id")

    # Manually insert an expired grant in the DB with created_at in the past
    # respecting the DB constraint ck_document_access_expires_after_creation (expires_at > created_at)
    async for db in get_db():
        await db.execute(
            text("""
                INSERT INTO document_access (
                    document_id, user_id, permission, granted_by, created_at, expires_at
                ) VALUES (
                    :doc_id, :recipient_id, 'DOWNLOAD', :owner_id,
                    CURRENT_TIMESTAMP - INTERVAL '2 hours',
                    CURRENT_TIMESTAMP - INTERVAL '1 hour'
                )
            """),
            {
                "doc_id": doc_id,
                "recipient_id": recipient["id"],
                "owner_id": owner["id"]
            }
        )
        await db.commit()
        break

    # Recipient download attempt on expired grant must fail with 403 expired
    down_exp = await client.get(
        f"/api/documents/{doc_id}/download",
        headers={"Authorization": f"Bearer {recipient['token']}"}
    )
    assert down_exp.status_code == 403
    assert "expired" in down_exp.json().get("message", "").lower()
