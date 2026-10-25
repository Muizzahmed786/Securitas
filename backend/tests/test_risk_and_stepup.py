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


async def test_risk_evaluation_endpoint_and_factors(client: AsyncClient):
    user = await create_user_and_token(client, "risk_user", 2)

    # 1. Normal INTERNAL evaluation -> LOW risk, ALLOW
    eval_resp = await client.post(
        "/api/risk/evaluate",
        json={
            "action": "documents.download",
            "classification": "INTERNAL"
        },
        headers={"Authorization": f"Bearer {user['token']}"}
    )
    assert eval_resp.status_code == 200
    data = eval_resp.json().get("data") or eval_resp.json()
    assert "risk_score" in data
    assert "factors" in data
    assert len(data["factors"]) == 6
    assert data["decision"] in ("ALLOW", "STEP_UP_AUTH")

    # 2. High sensitivity RESTRICTED document evaluation -> triggers higher score
    high_eval = await client.post(
        "/api/risk/evaluate",
        json={
            "action": "documents.download",
            "classification": "RESTRICTED"
        },
        headers={"Authorization": f"Bearer {user['token']}"}
    )
    assert high_eval.status_code == 200
    high_data = high_eval.json().get("data") or high_eval.json()
    assert high_data["risk_score"] >= data["risk_score"]


async def test_step_up_authentication_and_replay_prevention(client: AsyncClient):
    owner = await create_user_and_token(client, "stepup_owner", 2)

    # Upload a RESTRICTED document to trigger high sensitivity factor
    pdf_content = b"%PDF-1.4\nSuper Secret Restricted Government Data\n%%EOF"
    up_resp = await client.post(
        "/api/documents/upload",
        files={"file": ("restricted.pdf", pdf_content, "application/pdf")},
        data={"classification": "RESTRICTED"},
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert up_resp.status_code == 201
    doc_id = up_resp.json().get("id") or up_resp.json().get("data", {}).get("id")

    # Upsert user baseline with strict thresholds and insert recent activity to trigger HIGH risk
    async for db in get_db():
        await db.execute(
            text("""
                INSERT INTO user_behavior_profile (
                    user_id, role_id_at_baseline, avg_daily_access, avg_daily_download, avg_daily_search,
                    normal_start_time, normal_end_time, avg_sharing_count,
                    window_start, window_end, baseline_updated_at
                ) VALUES (
                    :uid, 2, 0.1, 0.1, 0.1, '01:00:00', '01:05:00', 0.1,
                    CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                ON CONFLICT (user_id) DO UPDATE SET
                    avg_daily_download = 0.1,
                    avg_daily_access = 0.1,
                    normal_start_time = '01:00:00',
                    normal_end_time = '01:05:00'
            """),
            {"uid": owner["id"]}
        )
        # Add 5 recent download events to trigger download and access frequency anomalies
        for _ in range(5):
            await db.execute(
                text("""
                    INSERT INTO audit_events (request_id, user_id, action, status, timestamp)
                    VALUES (gen_random_uuid(), :uid, 'documents.download', 'SUCCESS', CURRENT_TIMESTAMP)
                """),
                {"uid": owner["id"]}
            )
        await db.commit()
        break

    # 1. Direct download attempt without token should require Step-Up Auth (403)
    down_resp = await client.get(
        f"/api/documents/{doc_id}/download",
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert down_resp.status_code == 403
    err_body = down_resp.json()
    assert "step-up" in err_body.get("message", "").lower()
    errors = err_body.get("errors") or {}
    assert errors.get("step_up_required") is True
    challenge_id = errors.get("challenge_id")
    challenge_otp = errors.get("challenge_otp")
    assert challenge_id is not None
    assert challenge_otp is not None

    # 2. Test Invalid OTP fails
    bad_verify = await client.post(
        "/api/risk/step-up/verify",
        json={"challenge_id": challenge_id, "otp": "000000"},
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert bad_verify.status_code == 400
    assert "Invalid verification code" in bad_verify.json().get("message", "")

    # 3. Test Valid OTP succeeds and returns step-up token
    good_verify = await client.post(
        "/api/risk/step-up/verify",
        json={"challenge_id": challenge_id, "otp": challenge_otp},
        headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert good_verify.status_code == 200
    verify_data = good_verify.json().get("data") or good_verify.json()
    step_up_token = verify_data["step_up_token"]
    assert step_up_token is not None

    # 4. Download with X-Step-Up-Token header succeeds
    down_stepup = await client.get(
        f"/api/documents/{doc_id}/download",
        headers={
            "Authorization": f"Bearer {owner['token']}",
            "X-Step-Up-Token": step_up_token
        }
    )
    assert down_stepup.status_code == 200
    assert down_stepup.content == pdf_content

    # 5. Anti-Replay: Attempting to download again with the same step-up token must fail (403)
    replay_resp = await client.get(
        f"/api/documents/{doc_id}/download",
        headers={
            "Authorization": f"Bearer {owner['token']}",
            "X-Step-Up-Token": step_up_token
        }
    )
    assert replay_resp.status_code == 403
    assert "replay attack prevented" in replay_resp.json().get("message", "")


async def test_challenge_max_attempts_invalidation(client: AsyncClient):
    user = await create_user_and_token(client, "brute_user", 2)

    # Initialize baseline and recent activity to trigger STEP_UP_AUTH
    async for db in get_db():
        await db.execute(
            text("""
                INSERT INTO user_behavior_profile (
                    user_id, role_id_at_baseline, avg_daily_access, avg_daily_download, avg_daily_search,
                    normal_start_time, normal_end_time, avg_sharing_count,
                    window_start, window_end, baseline_updated_at
                ) VALUES (
                    :uid, 2, 0.1, 0.1, 0.1, '01:00:00', '01:05:00', 0.1,
                    CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                ON CONFLICT (user_id) DO UPDATE SET
                    avg_daily_download = 0.1,
                    avg_daily_access = 0.1,
                    normal_start_time = '01:00:00',
                    normal_end_time = '01:05:00'
            """),
            {"uid": user["id"]}
        )
        for _ in range(5):
            await db.execute(
                text("""
                    INSERT INTO audit_events (request_id, user_id, action, status, timestamp)
                    VALUES (gen_random_uuid(), :uid, 'documents.download', 'SUCCESS', CURRENT_TIMESTAMP)
                """),
                {"uid": user["id"]}
            )
        await db.commit()
        break

    eval_resp = await client.post(
        "/api/risk/evaluate",
        json={"action": "documents.download", "classification": "RESTRICTED"},
        headers={"Authorization": f"Bearer {user['token']}"}
    )
    assert eval_resp.status_code == 200
    data = eval_resp.json().get("data") or eval_resp.json()
    assert data.get("decision") == "STEP_UP_AUTH"
    challenge_id = data.get("step_up_challenge_id")
    assert challenge_id is not None

    # Attempt 5 wrong OTPs
    for i in range(5):
        resp = await client.post(
            "/api/risk/step-up/verify",
            json={"challenge_id": challenge_id, "otp": "999999"},
            headers={"Authorization": f"Bearer {user['token']}"}
        )
        assert resp.status_code == 400

    # 6th attempt must indicate max attempts exceeded or invalidated
    final_resp = await client.post(
        "/api/risk/step-up/verify",
        json={"challenge_id": challenge_id, "otp": "999999"},
        headers={"Authorization": f"Bearer {user['token']}"}
    )
    assert final_resp.status_code == 400
    assert "invalidated" in final_resp.json().get("message", "").lower() or "exceeded" in final_resp.json().get("message", "").lower()
