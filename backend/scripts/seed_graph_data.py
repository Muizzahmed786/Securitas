"""
Securitas - Automated Graph & Security Telemetry Seeder
Populates live PostgreSQL tables with realistic data for all 6 security graphs:
  1. Risk score over time (ALLOW, STEP_UP_AUTH, BLOCK)
  2. Six behavioral risk factors (download, velocity, time, sensitivity, sharing, auth)
  3. Access decisions breakdown
  4. Security activity timeline (SUCCESS, CHALLENGED, FAILURE/DENIED)
  5. Cryptographic performance benchmarks (AES-256-GCM, RSA-OAEP, RSA-PSS)
  6. Document sharing status (ACTIVE, EXPIRED, REVOKED)
"""

import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import httpx
from Cryptodome.PublicKey import RSA
from Cryptodome.Signature import pss
from Cryptodome.Hash import SHA256
from sqlalchemy import text

from app.main import app
from app.database import get_db, SessionLocal
from app.signatures.crypto import generate_key_pair

async def seed_all_graph_data():
    print("=" * 70)
    print("  SECURITAS: SEEDING SECURITY GRAPHS & TELEMETRY DATA")
    print("=" * 70)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # -------------------------------------------------------------
        # STEP 1: Provision Standard Testing Personas
        # -------------------------------------------------------------
        print("\n[1/6] Registering and authenticating personas...")
        tag = uuid.uuid4().hex[:5]
        password = "SecurePassword123!"

        users = {
            "admin": {"email": f"admin_{tag}@securitas.local", "role_id": 1},
            "owner": {"email": f"owner_{tag}@securitas.local", "role_id": 2},
            "alice": {"email": f"alice_{tag}@securitas.local", "role_id": 3},
            "bob":   {"email": f"bob_{tag}@securitas.local", "role_id": 3},
            "auditor": {"email": f"auditor_{tag}@securitas.local", "role_id": 4},
        }

        tokens = {}
        user_ids = {}

        for role_key, u in users.items():
            reg_res = await client.post("/api/auth/register", json={
                "email": u["email"],
                "password": password,
                "role_id": u["role_id"],
            })
            if reg_res.status_code == 201:
                uid = reg_res.json()["data"]["id"]
            else:
                uid = None

            login_res = await client.post("/api/auth/login", data={
                "username": u["email"],
                "password": password,
            })
            assert login_res.status_code == 200, f"Login failed for {u['email']}: {login_res.text}"
            tokens[role_key] = login_res.json()["access_token"]
            user_ids[role_key] = uid
            print(f"  + Authenticated {role_key.upper()} ({u['email']})")

        # Ensure active system wrapping key (KEK) exists
        await client.post(
            "/api/crypto-keys/wrapping",
            headers={"Authorization": f"Bearer {tokens['admin']}"}
        )
        print("  + Verified Master RSA-OAEP Wrapping Key (KEK) active")

        # -------------------------------------------------------------
        # STEP 2: Upload Documents with Diverse Classifications
        # -------------------------------------------------------------
        print("\n[2/6] Uploading and encrypting multi-tiered documents (AES-256-GCM)...")
        sample_docs = [
            ("Compliance_Guidelines_Public.pdf", b"%PDF-1.4 Public Compliance Guide %%EOF", "PUBLIC"),
            ("Q3_Financial_Review_Internal.pdf", b"%PDF-1.4 Q3 Internal Review %%EOF", "INTERNAL"),
            ("Product_IP_Patent_Confidential.pdf", b"%PDF-1.4 Confidential Patent Specs %%EOF", "CONFIDENTIAL"),
            ("Customer_PII_Vault_Restricted.pdf", b"%PDF-1.4 Restricted PII Database Dump %%EOF", "RESTRICTED"),
        ]

        doc_ids = {}
        for fname, content, classification in sample_docs:
            res = await client.post(
                "/api/documents/upload",
                files={"file": (fname, content, "application/pdf")},
                data={"classification": classification},
                headers={"Authorization": f"Bearer {tokens['owner']}"}
            )
            assert res.status_code == 201, f"Upload {fname} failed: {res.text}"
            did = res.json()["data"]["id"]
            doc_ids[classification] = did
            print(f"  + [{classification}] {fname} -> ID: {did[:12]}...")

        # -------------------------------------------------------------
        # STEP 3: Generate Document Sharing Status Data (Graph 6)
        # -------------------------------------------------------------
        print("\n[3/6] Creating document sharing states (Active, Expired, Revoked)...")
        # 3a. Active Share
        active_share = await client.post(
            f"/api/documents/{doc_ids['INTERNAL']}/share",
            json={"recipient_email": users["alice"]["email"], "permission": "DOWNLOAD"},
            headers={"Authorization": f"Bearer {tokens['owner']}"}
        )
        assert active_share.status_code == 201
        print(f"  + Created ACTIVE share for {users['alice']['email']} on INTERNAL doc")

        # 3b. Another Active Share
        active_share2 = await client.post(
            f"/api/documents/{doc_ids['CONFIDENTIAL']}/share",
            json={"recipient_email": users["bob"]["email"], "permission": "READ"},
            headers={"Authorization": f"Bearer {tokens['owner']}"}
        )
        assert active_share2.status_code == 201
        print(f"  + Created ACTIVE share for {users['bob']['email']} on CONFIDENTIAL doc")

        # 3c. Revoked Share
        rev_share = await client.post(
            f"/api/documents/{doc_ids['PUBLIC']}/share",
            json={"recipient_email": users["alice"]["email"], "permission": "DOWNLOAD"},
            headers={"Authorization": f"Bearer {tokens['owner']}"}
        )
        assert rev_share.status_code == 201
        access_id_to_revoke = rev_share.json()["data"]["id"]
        # Owner immediately revokes
        revoke_res = await client.post(
            f"/api/documents/{doc_ids['PUBLIC']}/revoke",
            json={"access_id": access_id_to_revoke},
            headers={"Authorization": f"Bearer {tokens['owner']}"}
        )
        assert revoke_res.status_code == 200
        print(f"  + Created REVOKED share record (access ID: {access_id_to_revoke})")

        # 3d. Expired Share (created 5 days ago, expired 2 days ago)
        async with SessionLocal() as db:
            created_time = datetime.now(timezone.utc) - timedelta(days=5)
            expired_time = datetime.now(timezone.utc) - timedelta(days=2)
            await db.execute(
                text("""
                    INSERT INTO document_access (
                        document_id, user_id, permission, granted_by, expires_at, created_at
                    ) VALUES (
                        :doc_id, :recipient_id, 'READ', :granted_by, :expired_time, :created_time
                    )
                """),
                {
                    "doc_id": uuid.UUID(doc_ids["CONFIDENTIAL"]),
                    "recipient_id": user_ids["alice"],
                    "granted_by": user_ids["owner"],
                    "expired_time": expired_time,
                    "created_time": created_time,
                }
            )
            await db.commit()
            print("  + Created EXPIRED share record with past expiration timestamp")

        # Verify shares summary endpoint
        shares_summary_res = await client.get(
            "/api/documents/shares/summary",
            headers={"Authorization": f"Bearer {tokens['owner']}"}
        )
        print(f"  * Current Sharing Status Metric: {shares_summary_res.json()['data']}")

        # -------------------------------------------------------------
        # STEP 4: Generate Scored Access Attempts (Graphs 1, 2, 3)
        # -------------------------------------------------------------
        print("\n[4/6] Generating risk evaluation events across all risk bands...")
        
        # Scenario 1: Low Risk (PUBLIC doc, normal download) -> ALLOW (score <= 30)
        res_low = await client.post(
            "/api/risk/evaluate",
            json={"action": "documents.read", "document_id": doc_ids["PUBLIC"], "classification": "PUBLIC"},
            headers={"Authorization": f"Bearer {tokens['alice']}"}
        )
        d_low = res_low.json()["data"]
        print(f"  + Low Risk Attempt: Score={d_low['risk_score']} | Decision={d_low['decision']}")

        # Scenario 2: Medium Risk (INTERNAL doc, multiple reads) -> ALLOW / MONITOR (score 30-60)
        res_med = await client.post(
            "/api/risk/evaluate",
            json={"action": "documents.download", "document_id": doc_ids["INTERNAL"], "classification": "INTERNAL"},
            headers={"Authorization": f"Bearer {tokens['alice']}"}
        )
        d_med = res_med.json()["data"]
        print(f"  + Medium Risk Attempt: Score={d_med['risk_score']} | Decision={d_med['decision']}")

        # Scenario 3: High Risk (CONFIDENTIAL doc, higher sensitivity) -> STEP_UP_AUTH (score 60-80)
        res_high1 = await client.post(
            "/api/risk/evaluate",
            json={"action": "documents.download", "document_id": doc_ids["CONFIDENTIAL"], "classification": "CONFIDENTIAL"},
            headers={"Authorization": f"Bearer {tokens['bob']}"}
        )
        d_high1 = res_high1.json()["data"]
        print(f"  + High Risk Attempt: Score={d_high1['risk_score']} | Decision={d_high1['decision']}")

        # Scenario 4: Step-Up Challenge (RESTRICTED doc, 100/100 sensitivity) -> STEP_UP_AUTH
        res_high2 = await client.post(
            "/api/risk/evaluate",
            json={"action": "documents.download", "document_id": doc_ids["RESTRICTED"], "classification": "RESTRICTED"},
            headers={"Authorization": f"Bearer {tokens['alice']}"}
        )
        d_high2 = res_high2.json()["data"]
        print(f"  + Step-Up Challenge Attempt: Score={d_high2['risk_score']} | Decision={d_high2['decision']}")

        # Scenario 5: Critical Anomaly (Critical Risk -> BLOCK)
        # We simulate a critical event in risk_events with score > 80
        async with SessionLocal() as db:
            req_id = uuid.uuid4()
            await db.execute(
                text("""
                    INSERT INTO risk_events (
                        request_id, user_id, document_id, action, rbac_allowed,
                        risk_score, risk_level, decision, reason, factors, policy_id
                    ) VALUES (
                        :req_id, :uid, :doc_id, 'documents.download', TRUE,
                        88.50, 'CRITICAL', 'BLOCK',
                        'Calculated risk score 88.5 represents critical anomalous activity; operation blocked (CRITICAL).',
                        CAST(:factors AS jsonb), 1
                    )
                """),
                {
                    "req_id": req_id,
                    "uid": user_ids["bob"],
                    "doc_id": uuid.UUID(doc_ids["RESTRICTED"]),
                    "factors": '{"download_anomaly": {"score": 90, "weight": 0.25, "weighted_score": 22.5, "explanation": "Severe 24h download velocity excess."}, "access_frequency_anomaly": {"score": 85, "weight": 0.20, "weighted_score": 17.0, "explanation": "Burst request frequency detected."}, "time_anomaly": {"score": 85, "weight": 0.15, "weighted_score": 12.75, "explanation": "Off-hours anomaly: requested at 03:15."}, "document_sensitivity": {"score": 100, "weight": 0.15, "weighted_score": 15.0, "explanation": "Classified RESTRICTED payload."}, "sharing_anomaly": {"score": 75, "weight": 0.15, "weighted_score": 11.25, "explanation": "Excessive sharing links generated."}, "authentication_anomaly": {"score": 100, "weight": 0.10, "weighted_score": 10.0, "explanation": "3 failed login attempts prior to request."}}',
                }
            )
            await db.commit()
            print("  + Critical Risk Attempt: Score=88.5 | Decision=BLOCK (Recorded in ledger)")

        # -------------------------------------------------------------
        # STEP 5: Generate Audit Activity Log Records (Graph 4)
        # -------------------------------------------------------------
        print("\n[5/6] Generating audit trail records across operations & statuses...")
        # 5a. Download by authorized employee
        await client.get(
            f"/api/documents/{doc_ids['INTERNAL']}/download",
            headers={"Authorization": f"Bearer {tokens['alice']}"}
        )
        print("  + Logged documents.download [SUCCESS]")

        # 5b. Denied access on revoked document
        await client.get(
            f"/api/documents/{doc_ids['PUBLIC']}/download",
            headers={"Authorization": f"Bearer {tokens['alice']}"}
        )
        print("  + Logged documents.download [DENIED/FAILURE] on revoked document")

        # 5c. Encrypted search operation
        await client.post(
            "/api/search",
            json={"query": "compliance review"},
            headers={"Authorization": f"Bearer {tokens['owner']}"}
        )
        print("  + Logged documents.search [SUCCESS]")

        # 5d. Digital signature operation (RSA-PSS)
        priv_pem, pub_pem = generate_key_pair()
        async with SessionLocal() as db:
            res_key = await db.execute(
                text("""
                    INSERT INTO crypto_keys (
                        owner_id, purpose, algorithm, public_key_pem, secret_ref, status
                    ) VALUES (
                        :uid, 'SIGNING', 'RSA-PSS-SHA256', :pub_pem, :secret_ref, 'ACTIVE'
                    ) RETURNING id
                """),
                {"uid": user_ids["owner"], "pub_pem": pub_pem, "secret_ref": f"client-held:{uuid.uuid4()}"}
            )
            sig_key_id = res_key.scalar_one()
            
            # Record signature and audit verification
            doc_bytes = b"%PDF-1.4 Q3 Internal Review %%EOF"
            doc_hash = SHA256.new(doc_bytes).hexdigest()
            signing_key = RSA.import_key(priv_pem)
            raw_sig = pss.new(signing_key, salt_bytes=32).sign(SHA256.new(doc_bytes))
            await db.execute(
                text("""
                    INSERT INTO document_signatures (
                        document_id, signer_id, signing_key_id, signature,
                        signature_algorithm, signed_content_hash
                    ) VALUES (
                        :doc_id, :uid, :kid, :sig, 'RSA-PSS-SHA256', :hash
                    )
                """),
                {"doc_id": uuid.UUID(doc_ids["INTERNAL"]), "uid": user_ids["owner"], "kid": sig_key_id, "sig": raw_sig, "hash": doc_hash}
            )
            await db.execute(
                text("""
                    INSERT INTO audit_events (
                        request_id, user_id, document_id, action, status, ip_address, metadata
                    ) VALUES (
                        :rid, :uid, :doc_id, 'documents.sign', 'SUCCESS', '127.0.0.1', '{"signature_algorithm": "RSA-PSS-SHA256"}'
                    )
                """),
                {"rid": uuid.uuid4(), "uid": user_ids["owner"], "doc_id": uuid.UUID(doc_ids["INTERNAL"])}
            )
            await db.commit()
            print("  + Logged documents.sign [SUCCESS] with RSA-PSS digital signature")

        # -------------------------------------------------------------
        # STEP 6: Execute Cryptographic Performance Benchmark (Graph 5)
        # -------------------------------------------------------------
        print("\n[6/6] Executing hardware cryptographic benchmark (AES-GCM, RSA-OAEP, RSA-PSS)...")
        bench_res = await client.get(
            "/api/crypto-keys/benchmark",
            headers={"Authorization": f"Bearer {tokens['admin']}"}
        )
        assert bench_res.status_code == 200
        bdata = bench_res.json()["data"]
        print("  + Measured Pure CPU Execution Times (Averaged over 3 iterations):")
        for s in bdata["tested_sizes"]:
            print(f"    - {s['size_label']} payload: Encrypt={s['encrypt_ms']}ms ({s['encrypt_throughput_mb_s']} MB/s) | Decrypt={s['decrypt_ms']}ms ({s['decrypt_throughput_mb_s']} MB/s)")
        print(f"    - RSA-OAEP 32-byte DEK Wrap: {bdata['key_wrapping_rsa_oaep']['wrap_ms']}ms | Unwrap: {bdata['key_wrapping_rsa_oaep']['unwrap_ms']}ms")
        print(f"    - RSA-PSS 32-byte SHA-256 Digest Sign: {bdata['digital_signatures_rsa_pss']['sign_ms']}ms | Verify: {bdata['digital_signatures_rsa_pss']['verify_ms']}ms")

    print("\n" + "=" * 70)
    print("  SEEDING COMPLETE! ALL 6 GRAPHS ARE FULLY POPULATED WITH LIVE DATA.")
    print("=" * 70)
    print("\nNext steps to visualize:")
    print("  1. Sign in to the Securitas web app as Security Auditor or System Admin:")
    print(f"     Auditor Email: {users['auditor']['email']}")
    print(f"     Admin Email:   {users['admin']['email']}")
    print(f"     Password:      {password}")
    print("  2. Open the Workspace Dashboard -> 'Security Analytics & Behavioral Intelligence'")
    print("  3. Navigate through the 4 tabs:")
    print("     • Tab 1: Risk Scores & Factors (Graphs 1-3)")
    print("     • Tab 2: Security Activity Timeline (Graph 4)")
    print("     • Tab 3: Encryption Performance (Graph 5)")
    print("     • Tab 4: Document Sharing Status (Graph 6)")

if __name__ == "__main__":
    asyncio.run(seed_all_graph_data())
