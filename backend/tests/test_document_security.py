import uuid
from pathlib import Path
import pytest
from httpx import AsyncClient, ASGITransport
from Cryptodome.PublicKey import RSA
from Cryptodome.Signature import pss
from Cryptodome.Hash import SHA256
import base64

from app.main import app

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


async def ensure_wrapping_key(client: AsyncClient, admin_token: str):
    resp = await client.post(
        "/api/crypto-keys/wrapping",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    # 201 if newly created, 409 if already exists
    assert resp.status_code in (201, 409)


async def test_upload_and_download_flow(client: AsyncClient):
    admin = await create_user_and_token(client, "admin", 1)
    await ensure_wrapping_key(client, admin["token"])

    owner = await create_user_and_token(client, "owner", 2)
    pdf_content = b"%PDF-1.4\nTest Document Content for Securitas Confidential Storage\n%%EOF"

    upload_resp = await client.post(
        "/api/documents/upload",
        files={"file": ("report.pdf", pdf_content, "application/pdf")},
        data={"classification": "INTERNAL"},
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert upload_resp.status_code == 201
    doc_id = upload_resp.json().get("id") or upload_resp.json().get("data", {}).get("id")
    assert doc_id is not None

    # Retrieve metadata
    meta_resp = await client.get(
        f"/api/documents/{doc_id}",
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert meta_resp.status_code == 200
    meta = meta_resp.json().get("data") or meta_resp.json()
    assert meta["filename"] == "report.pdf"
    assert meta["classification"] == "INTERNAL"

    # Download document
    down_resp = await client.get(
        f"/api/documents/{doc_id}/download",
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert down_resp.status_code == 200
    assert down_resp.content == pdf_content


async def test_cryptographic_failure_on_tampered_ciphertext(client: AsyncClient):
    admin = await create_user_and_token(client, "admin", 1)
    await ensure_wrapping_key(client, admin["token"])

    owner = await create_user_and_token(client, "tamper_owner", 2)
    pdf_content = b"%PDF-1.4\nSensitive original content\n%%EOF"

    upload_resp = await client.post(
        "/api/documents/upload",
        files={"file": ("tamper.pdf", pdf_content, "application/pdf")},
        data={"classification": "INTERNAL"},
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert upload_resp.status_code == 201
    doc_id = upload_resp.json().get("id") or upload_resp.json().get("data", {}).get("id")

    # Locate storage file and tamper with its bytes
    enc_path = Path("./private_uploads") / f"{doc_id}.enc"
    if not enc_path.exists():
        enc_path = Path("./backend/private_uploads") / f"{doc_id}.enc"
    assert enc_path.exists()
    original_bytes = enc_path.read_bytes()

    # Corrupt one byte of the ciphertext
    tampered_bytes = bytearray(original_bytes)
    tampered_bytes[0] ^= 0xFF
    enc_path.write_bytes(bytes(tampered_bytes))

    try:
        # Download attempt must fail with 409 Conflict (tampering detected / MAC check failed)
        down_resp = await client.get(
            f"/api/documents/{doc_id}/download",
            headers={"Authorization": f"Bearer {owner['token']}"}
        )
        assert down_resp.status_code == 409
    finally:
        # Restore for cleanup
        enc_path.write_bytes(original_bytes)


async def test_signing_and_verification(client: AsyncClient):
    admin = await create_user_and_token(client, "admin", 1)
    await ensure_wrapping_key(client, admin["token"])

    owner = await create_user_and_token(client, "signer", 2)
    pdf_content = b"%PDF-1.4\nLegal contract for digital signature verification\n%%EOF"

    # 1. Upload
    up_resp = await client.post(
        "/api/documents/upload",
        files={"file": ("contract.pdf", pdf_content, "application/pdf")},
        data={"classification": "INTERNAL"},
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert up_resp.status_code == 201
    doc_id = up_resp.json().get("id") or up_resp.json().get("data", {}).get("id")

    # 2. Generate signing key
    key_resp = await client.post(
        "/api/signatures/keys/generate",
        json={"passphrase": None},
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert key_resp.status_code == 201
    private_pem = key_resp.content
    signing_key_id = key_resp.headers.get("X-Signing-Key-Id")
    assert signing_key_id is not None

    # Sign locally using the generated private key
    priv_key = RSA.import_key(private_pem)
    h = SHA256.new(pdf_content)
    raw_sig = pss.new(priv_key, salt_bytes=32).sign(h)
    sig_b64 = base64.b64encode(raw_sig).decode("ascii")

    # 3. Submit signature
    submit_resp = await client.post(
        f"/api/signatures/documents/{doc_id}",
        json={
            "signing_key_id": signing_key_id,
            "signature_base64": sig_b64
        },
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert submit_resp.status_code == 201

    # 4. Verify document signatures
    verify_resp = await client.post(
        f"/api/documents/{doc_id}/verify",
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert verify_resp.status_code == 200
    vdata = verify_resp.json().get("data") or verify_resp.json()
    assert vdata["document_integrity_valid"] is True
    assert vdata["has_signatures"] is True
    assert len(vdata["signatures"]) >= 1
    assert vdata["signatures"][0]["cryptographically_valid"] is True
