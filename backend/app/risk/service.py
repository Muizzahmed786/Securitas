import hmac
import hashlib
import json
import secrets
from datetime import datetime, timezone, timedelta
from uuid import UUID, uuid4
from sqlalchemy import text
import jwt

from app.config import (
    STEP_UP_HMAC_SECRET,
    ACCESS_TOKEN_SECRET,
)
from app.risk.schemas import RiskContext, RiskResult
from app.risk.policies import get_active_risk_policy
from app.risk.baseline import get_or_create_user_baseline
from app.risk.factors import (
    evaluate_download_anomaly,
    evaluate_access_frequency_anomaly,
    evaluate_time_anomaly,
    evaluate_document_sensitivity,
    evaluate_sharing_anomaly,
    evaluate_authentication_anomaly,
)
from app.risk.scorer import score_risk
from app.utils.ApiError import ApiError


def compute_otp_digest(otp: str) -> bytes:
    return hmac.new(
        STEP_UP_HMAC_SECRET.encode("utf-8"),
        otp.encode("utf-8"),
        hashlib.sha256
    ).digest()


async def evaluate_risk(context: RiskContext, db, request_id: UUID = None) -> tuple[RiskResult, str | None]:
    if request_id is None:
        request_id = uuid4()

    policy = await get_active_risk_policy(db)
    baseline = await get_or_create_user_baseline(db, context.user_id)

    # Evaluate all 6 factors
    f_down = await evaluate_download_anomaly(context, baseline, db, policy["download_weight"])
    f_acc = await evaluate_access_frequency_anomaly(context, baseline, db, policy["access_weight"])
    f_time = await evaluate_time_anomaly(context, baseline, db, policy["time_weight"])
    f_sens = await evaluate_document_sensitivity(context, baseline, db, policy["sensitivity_weight"])
    f_share = await evaluate_sharing_anomaly(context, baseline, db, policy["sharing_weight"])
    f_auth = await evaluate_authentication_anomaly(context, baseline, db, policy["authentication_weight"])

    factors = {
        "download_anomaly": f_down,
        "access_frequency_anomaly": f_acc,
        "time_anomaly": f_time,
        "document_sensitivity": f_sens,
        "sharing_anomaly": f_share,
        "authentication_anomaly": f_auth,
    }

    score, level, decision, reason = score_risk(factors, policy)
    event_id = uuid4()
    factors_json = {k: v.model_dump() for k, v in factors.items()}
    context_json = {
        "user_id": context.user_id,
        "role": context.user_role,
        "action": context.action,
        "classification": context.document_classification,
        "timestamp": context.timestamp.isoformat(),
        "ip_address": context.ip_address,
    }

    await db.execute(
        text("""
            INSERT INTO risk_events (
                id, request_id, user_id, document_id, action, rbac_allowed,
                policy_id, policy_snapshot, context, risk_score, risk_level,
                factors, decision, reason, timestamp
            ) VALUES (
                :id, :request_id, :user_id, :document_id, :action, TRUE,
                :policy_id, CAST(:policy_snapshot AS jsonb), CAST(:context AS jsonb),
                :risk_score, :risk_level, CAST(:factors AS jsonb), :decision, :reason, CURRENT_TIMESTAMP
            )
        """),
        {
            "id": event_id,
            "request_id": request_id,
            "user_id": context.user_id,
            "document_id": context.document_id,
            "action": context.action,
            "policy_id": policy["id"],
            "policy_snapshot": json.dumps(policy),
            "context": json.dumps(context_json),
            "risk_score": score,
            "risk_level": level,
            "factors": json.dumps(factors_json),
            "decision": decision,
            "reason": reason,
        }
    )

    challenge_id = None
    plain_otp = None

    if decision == "STEP_UP_AUTH":
        challenge_id = uuid4()
        # Generate 6-digit cryptographic OTP
        plain_otp = f"{secrets.randbelow(900000) + 100000}"
        otp_digest = compute_otp_digest(plain_otp)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

        # Session ID must be valid or fallback to a newly bound session
        session_id = context.session_id
        if not session_id:
            # Look up active session for this user
            sess_res = await db.execute(
                text("SELECT id FROM auth_sessions WHERE user_id = :uid AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1"),
                {"uid": context.user_id}
            )
            found_sess = sess_res.mappings().first()
            if found_sess:
                session_id = found_sess["id"]
            else:
                session_id = uuid4()
                now_sess = datetime.now(timezone.utc)
                await db.execute(
                    text("""
                        INSERT INTO auth_sessions (id, user_id, jwt_jti, created_at, expires_at)
                        VALUES (:id, :uid, :jti, :created, :exp)
                    """),
                    {
                        "id": session_id,
                        "uid": context.user_id,
                        "jti": uuid4(),
                        "created": now_sess,
                        "exp": now_sess + timedelta(minutes=15)
                    }
                )

        await db.execute(
            text("""
                INSERT INTO step_up_challenges (
                    id, user_id, session_id, risk_event_id, otp_digest,
                    attempts, max_attempts, created_at, expires_at
                ) VALUES (
                    :id, :user_id, :session_id, :risk_event_id, :otp_digest,
                    0, 5, CURRENT_TIMESTAMP, :expires_at
                )
            """),
            {
                "id": challenge_id,
                "user_id": context.user_id,
                "session_id": session_id,
                "risk_event_id": event_id,
                "otp_digest": otp_digest,
                "expires_at": expires_at,
            }
        )

    await db.commit()

    result = RiskResult(
        risk_score=score,
        risk_level=level,
        decision=decision,
        reason=reason,
        factors=factors,
        policy_id=policy["id"],
        policy_snapshot=policy,
        event_id=event_id,
        step_up_challenge_id=challenge_id,
    )
    return result, plain_otp


async def verify_step_up_challenge(db, user_id: int, challenge_id: UUID, otp: str) -> str:
    res = await db.execute(
        text("""
            SELECT id, user_id, session_id, risk_event_id, otp_digest, attempts, max_attempts,
                   expires_at, verified_at, consumed_at, invalidated_at
            FROM step_up_challenges
            WHERE id = :id AND user_id = :user_id
            FOR UPDATE
        """),
        {"id": challenge_id, "user_id": user_id}
    )
    challenge = res.mappings().first()
    if not challenge:
        raise ApiError(404, "Step-up challenge not found")

    now = datetime.now(timezone.utc)
    if challenge["consumed_at"] is not None:
        raise ApiError(400, "Step-up challenge has already been consumed")
    if challenge["invalidated_at"] is not None:
        raise ApiError(400, "Step-up challenge has been invalidated due to failed attempts")
    if challenge["expires_at"] <= now:
        raise ApiError(400, "Step-up challenge has expired")
    if challenge["attempts"] >= challenge["max_attempts"]:
        await db.execute(
            text("UPDATE step_up_challenges SET invalidated_at = CURRENT_TIMESTAMP WHERE id = :id"),
            {"id": challenge_id}
        )
        await db.commit()
        raise ApiError(400, "Maximum OTP verification attempts exceeded")

    new_attempts = challenge["attempts"] + 1
    input_digest = compute_otp_digest(otp.strip())

    if not hmac.compare_digest(input_digest, bytes(challenge["otp_digest"])):
        await db.execute(
            text("UPDATE step_up_challenges SET attempts = :attempts WHERE id = :id"),
            {"attempts": new_attempts, "id": challenge_id}
        )
        await db.commit()
        raise ApiError(400, "Invalid verification code")

    await db.execute(
        text("UPDATE step_up_challenges SET verified_at = CURRENT_TIMESTAMP, attempts = :attempts WHERE id = :id"),
        {"attempts": new_attempts, "id": challenge_id}
    )
    await db.commit()

    # Generate single-use step-up authorization token bound to challenge, user, and session
    token_payload = {
        "sub": str(user_id),
        "challenge_id": str(challenge_id),
        "risk_event_id": str(challenge["risk_event_id"]),
        "type": "step_up",
        "iat": now,
        "exp": now + timedelta(minutes=5)
    }
    step_up_token = jwt.encode(token_payload, ACCESS_TOKEN_SECRET, algorithm="HS256")
    return step_up_token


async def consume_step_up_token(db, user_id: int, step_up_token: str) -> UUID:
    try:
        payload = jwt.decode(step_up_token, ACCESS_TOKEN_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError as e:
        raise ApiError(401, f"Invalid step-up token: {e}")

    if payload.get("type") != "step_up":
        raise ApiError(401, "Token is not a step-up authorization token")
    if int(payload.get("sub", 0)) != user_id:
        raise ApiError(403, "Step-up token does not belong to current user")

    challenge_id = UUID(payload["challenge_id"])
    res = await db.execute(
        text("""
            SELECT id, verified_at, consumed_at, invalidated_at, expires_at
            FROM step_up_challenges
            WHERE id = :id AND user_id = :user_id
            FOR UPDATE
        """),
        {"id": challenge_id, "user_id": user_id}
    )
    ch = res.mappings().first()
    if not ch:
        raise ApiError(404, "Step-up challenge record not found")
    if ch["verified_at"] is None:
        raise ApiError(403, "Challenge has not been verified")
    if ch["consumed_at"] is not None:
        raise ApiError(403, "Step-up challenge has already been used (replay attack prevented)")
    if ch["expires_at"] <= datetime.now(timezone.utc):
        raise ApiError(403, "Step-up token has expired")

    # Mark as consumed immediately
    await db.execute(
        text("UPDATE step_up_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE id = :id"),
        {"id": challenge_id}
    )
    await db.commit()
    return challenge_id
