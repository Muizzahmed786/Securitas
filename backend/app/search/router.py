import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.database import get_db
from app.rbac.dependency import require_permission
from app.risk.schemas import RiskContext
from app.risk.service import (
    consume_step_up_token,
    evaluate_risk,
    verify_step_up_challenge,
)
from app.utils.ApiError import ApiError
from app.utils.ApiResponse import ApiResponse

from .service import (
    active_key,
    highest_classification,
    keyword_token,
    matches,
    query_words,
)

router = APIRouter()


class SearchInput(BaseModel):
    query: str = Field(min_length=1, max_length=300)
    challenge_id: UUID | None = None
    otp: str | None = Field(
        default=None,
        min_length=6,
        max_length=6,
    )


async def require_live_session(db, user) -> UUID:
    try:
        session_id = UUID(str(user["session_id"]))
    except (KeyError, ValueError, TypeError) as error:
        raise ApiError(
            401,
            "Sign in again before searching",
        ) from error

    result = await db.execute(
        text("""
            SELECT EXISTS (
                SELECT 1
                FROM auth_sessions
                WHERE id = :sid
                  AND user_id = :uid
                  AND revoked_at IS NULL
                  AND expires_at > clock_timestamp()
            )
        """),
        {
            "sid": session_id,
            "uid": user["id"],
        },
    )

    if not result.scalar_one():
        raise ApiError(401, "Your session has expired")

    return session_id


async def audit_search(
    db,
    user_id,
    request_id,
    event_id,
    status: str,
) -> None:
    # Do not swallow audit failures or log query text.
    await db.execute(
        text("""
            INSERT INTO audit_events (
                request_id,
                user_id,
                risk_event_id,
                action,
                status,
                metadata
            )
            VALUES (
                :rid,
                :uid,
                :eid,
                'documents.search',
                :status,
                '{}'
            )
        """),
        {
            "rid": request_id,
            "uid": user_id,
            "eid": event_id,
            "status": status,
        },
    )

    await db.commit()


@router.post("")
async def search_documents(
    body: SearchInput,
    request: Request,
    response: Response,
    user=Depends(require_permission("documents.search")),
    db=Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"

    words = query_words(body.query)

    challenge_id = body.challenge_id
    submitted_otp = body.otp

    if (challenge_id is None) != (submitted_otp is None):
        raise ApiError(
            400,
            "Provide both the search challenge ID and OTP",
        )

    session_id = await require_live_session(db, user)
    key_id, key = await active_key(db)
    classification = await highest_classification(db, user["id"])

    binding_payload = json.dumps(
        [str(key_id), words, classification],
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")

    binding = hmac.new(
        key,
        b"securitas:query:v1\0" + binding_payload,
        hashlib.sha256,
    ).hexdigest()

    request_id = uuid4()

    context = RiskContext(
        user_id=user["id"],
        user_role=user["role"],
        action="documents.search",
        document_id=None,
        document_classification=classification,
        timestamp=datetime.now(timezone.utc),
        ip_address=(
            request.client.host
            if request.client is not None
            else "127.0.0.1"
        ),
        user_agent=request.headers.get("user-agent"),
        session_id=session_id,
    )

    result, generated_otp = await evaluate_risk(
        context,
        db,
        request_id=request_id,
    )

    if result.decision in ("BLOCK", "RESTRICT"):
        await audit_search(
            db,
            user["id"],
            request_id,
            result.event_id,
            "DENIED",
        )

        raise ApiError(
            403,
            "Search is restricted by the current security policy",
        )

    if result.decision not in ("ALLOW", "STEP_UP_AUTH"):
        raise ApiError(
            503,
            "Search risk assessment is unavailable",
        )

    verified = False

    # Check both values explicitly so submitted_otp is narrowed to str.
    if challenge_id is not None and submitted_otp is not None:
        challenge_result = await db.execute(
            text("""
                SELECT
                    c.id,
                    c.invalidated_at,
                    c.consumed_at,
                    c.expires_at,
                    b.query_binding,
                    e.policy_id
                FROM step_up_challenges c
                JOIN risk_events e
                    ON e.id = c.risk_event_id
                JOIN search_challenge_context b
                    ON b.challenge_id = c.id
                WHERE c.id = :id
                  AND c.user_id = :uid
                  AND c.session_id = :sid
                  AND e.action = 'documents.search'
                  AND e.decision = 'STEP_UP_AUTH'
                FOR UPDATE OF c
            """),
            {
                "id": challenge_id,
                "uid": user["id"],
                "sid": session_id,
            },
        )

        row = challenge_result.mappings().first()

        if row is None:
            await db.rollback()
            raise ApiError(
                403,
                "Search challenge is no longer valid; start a new search",
            )

        valid = (
            row["invalidated_at"] is None
            and row["consumed_at"] is None
            and row["expires_at"] > datetime.now(timezone.utc)
            and row["policy_id"] == result.policy_id
            and hmac.compare_digest(row["query_binding"], binding)
        )

        if not valid:
            await db.rollback()
            raise ApiError(
                403,
                "Search challenge is no longer valid; start a new search",
            )

        # A retry uses the original challenge. Invalidate any different
        # challenge generated by this risk evaluation.
        new_challenge_id = result.step_up_challenge_id

        if (
            new_challenge_id is not None
            and new_challenge_id != challenge_id
        ):
            await db.execute(
                text("""
                    UPDATE step_up_challenges
                    SET invalidated_at = CURRENT_TIMESTAMP
                    WHERE id = :id
                """),
                {"id": new_challenge_id},
            )

        token = await verify_step_up_challenge(
            db,
            user["id"],
            challenge_id,
            submitted_otp,
        )

        await consume_step_up_token(
            db,
            user["id"],
            token,
        )

        verified = True

    if result.decision == "STEP_UP_AUTH" and not verified:
        new_challenge_id = result.step_up_challenge_id

        if new_challenge_id is None:
            raise ApiError(
                503,
                "Search authentication challenge is unavailable",
            )

        await db.execute(
            text("""
                INSERT INTO search_challenge_context (
                    challenge_id,
                    query_binding
                )
                VALUES (:id, :binding)
            """),
            {
                "id": new_challenge_id,
                "binding": binding,
            },
        )

        await audit_search(
            db,
            user["id"],
            request_id,
            result.event_id,
            "CHALLENGED",
        )

        details: dict[str, str | bool] = {
            "step_up_required": True,
            "challenge_id": str(new_challenge_id),
        }

        demo_enabled = (
            os.getenv("SEARCH_DEMO_OTP", "false").lower() == "true"
        )

        if demo_enabled and generated_otp is not None:
            details["challenge_otp"] = str(generated_otp)

        raise ApiError(
            403,
            "Verify the OTP to search",
            errors=details,
        )

    await require_live_session(db, user)

    current_classification = await highest_classification(
        db,
        user["id"],
    )

    if current_classification != classification:
        raise ApiError(
            409,
            "Document access changed; submit the search again",
        )

    current_id, current_key = await active_key(db)

    if (
        current_id != key_id
        or not hmac.compare_digest(current_key, key)
    ):
        raise ApiError(
            409,
            "Search key changed; submit the search again",
        )

    tokens = [keyword_token(key, word) for word in words]

    found = await matches(
        db,
        user["id"],
        key_id,
        tokens,
        classification,
    )

    await audit_search(
        db,
        user["id"],
        request_id,
        result.event_id,
        "SUCCESS",
    )

    return ApiResponse(200, found, "Search complete")