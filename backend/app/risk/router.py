import json
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy import text

from app.database import get_db
from app.auth.router import verify_jwt
from app.rbac.dependency import require_permission
from app.utils.ApiError import ApiError
from app.utils.ApiResponse import ApiResponse
from app.utils.FormatRequest import read_body
from app.risk.schemas import RiskContext, StepUpVerifyRequest
from app.risk.service import evaluate_risk, verify_step_up_challenge
from app.risk.policies import get_active_risk_policy

router = APIRouter()

VALID_ACTIONS = {
    "documents.download",
    "documents.read",
    "documents.search",
    "documents.upload",
    "documents.share",
    "documents.verify",
}
VALID_CLASSIFICATIONS = {"PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"}


@router.post("/evaluate")
async def evaluate_risk_endpoint(
    request: Request,
    user=Depends(verify_jwt),
    db=Depends(get_db),
):
    body = await read_body(request)
    action = body.get("action", "documents.download")
    if action not in VALID_ACTIONS:
        raise ApiError(400, f"Invalid action. Must be one of: {sorted(list(VALID_ACTIONS))}")
    doc_id_raw = body.get("document_id")
    document_id = UUID(doc_id_raw) if doc_id_raw else None
    classification = str(body.get("classification", "INTERNAL")).strip().upper()
    if classification not in VALID_CLASSIFICATIONS:
        raise ApiError(400, f"Invalid classification. Must be one of: {sorted(list(VALID_CLASSIFICATIONS))}")

    context = RiskContext(
        user_id=user["id"],
        user_role=user["role"],
        action=action,
        document_id=document_id,
        document_classification=classification,
        timestamp=datetime.now(timezone.utc),
        ip_address=request.client.host if request.client else "127.0.0.1",
        user_agent=request.headers.get("user-agent"),
        session_id=UUID(user.get("session_id")) if user.get("session_id") else None,
    )

    result, plain_otp = await evaluate_risk(context, db)
    resp_data = {
        "risk_score": result.risk_score,
        "risk_level": result.risk_level,
        "decision": result.decision,
        "reason": result.reason,
        "factors": {k: v.model_dump() for k, v in result.factors.items()},
        "step_up_challenge_id": str(result.step_up_challenge_id) if result.step_up_challenge_id else None,
    }
    # In development/test mode return otp for verification convenience
    if plain_otp:
        resp_data["challenge_otp"] = plain_otp

    return ApiResponse(200, resp_data, f"Risk evaluation: {result.decision}")


@router.post("/step-up/verify")
async def verify_step_up_endpoint(
    request: Request,
    user=Depends(verify_jwt),
    db=Depends(get_db),
):
    body = await read_body(request)
    challenge_id_raw = body.get("challenge_id")
    otp = body.get("otp")

    if not challenge_id_raw or not otp:
        raise ApiError(400, "challenge_id and otp are required")

    try:
        challenge_id = UUID(challenge_id_raw)
    except ValueError:
        raise ApiError(400, "Invalid challenge_id UUID")

    step_up_token = await verify_step_up_challenge(db, user["id"], challenge_id, str(otp))
    return ApiResponse(
        200,
        {
            "step_up_token": step_up_token,
            "challenge_id": str(challenge_id),
            "status": "VERIFIED",
        },
        "Step-up challenge verified successfully"
    )


@router.get("/events")
async def list_risk_events(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user=Depends(require_permission("risk.read")),
    db=Depends(get_db),
):
    result = await db.execute(
        text("""
            SELECT id, request_id, user_id, document_id, action, rbac_allowed,
                   risk_score, risk_level, factors, decision, reason, timestamp
            FROM risk_events
            ORDER BY timestamp DESC
            LIMIT :limit OFFSET :offset
        """),
        {"limit": limit, "offset": offset}
    )
    events = []
    for row in result.mappings().all():
        item = dict(row)
        item["id"] = str(item["id"])
        item["request_id"] = str(item["request_id"])
        item["document_id"] = str(item["document_id"]) if item["document_id"] else None
        item["timestamp"] = item["timestamp"].isoformat() if item["timestamp"] else None
        if isinstance(item.get("factors"), str):
            try:
                item["factors"] = json.loads(item["factors"])
            except Exception:
                pass
        events.append(item)

    return ApiResponse(200, events, "Risk events fetched successfully")


@router.get("/policy")
async def get_policy_endpoint(
    user=Depends(verify_jwt),
    db=Depends(get_db),
):
    policy = await get_active_risk_policy(db)
    return ApiResponse(200, policy, "Active risk policy fetched successfully")
