import json
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text

from app.database import get_db
from app.rbac.dependency import require_permission
from app.utils.ApiResponse import ApiResponse

router = APIRouter()


@router.get("/events")
async def list_audit_events(
    action: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user=Depends(require_permission("audit.read")),
    db=Depends(get_db),
):
    query_str = """
        SELECT a.id, a.request_id, a.user_id, a.document_id, a.risk_event_id,
               a.action, a.status, a.ip_address, a.timestamp, a.metadata,
               u.email AS user_email
        FROM audit_events a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE 1=1
    """
    params = {"limit": limit, "offset": offset}

    if action:
        query_str += " AND a.action = :action"
        params["action"] = action
    if status:
        query_str += " AND a.status = :status"
        params["status"] = status
    if user_id:
        query_str += " AND a.user_id = :user_id"
        params["user_id"] = user_id

    query_str += " ORDER BY a.timestamp DESC LIMIT :limit OFFSET :offset"

    result = await db.execute(text(query_str), params)
    events = []
    for row in result.mappings().all():
        item = dict(row)
        item["id"] = int(item["id"])
        item["request_id"] = str(item["request_id"])
        item["document_id"] = str(item["document_id"]) if item["document_id"] else None
        item["risk_event_id"] = str(item["risk_event_id"]) if item["risk_event_id"] else None
        item["ip_address"] = str(item["ip_address"]) if item["ip_address"] else None
        item["timestamp"] = item["timestamp"].isoformat() if item["timestamp"] else None
        if isinstance(item.get("metadata"), str):
            try:
                item["metadata"] = json.loads(item["metadata"])
            except Exception:
                pass
        events.append(item)

    return ApiResponse(200, events, "Audit events fetched successfully")


@router.get("/stats")
async def get_audit_stats(
    user=Depends(require_permission("audit.read")),
    db=Depends(get_db),
):
    # Total counts by status
    status_res = await db.execute(
        text("SELECT status, count(*) FROM audit_events GROUP BY status")
    )
    status_counts = {r[0]: r[1] for r in status_res.fetchall()}

    # Total counts by action
    action_res = await db.execute(
        text("SELECT action, count(*) FROM audit_events GROUP BY action ORDER BY count(*) DESC LIMIT 10")
    )
    action_counts = {r[0]: r[1] for r in action_res.fetchall()}

    # Risk level distribution from risk_events
    risk_res = await db.execute(
        text("SELECT risk_level, count(*) FROM risk_events GROUP BY risk_level")
    )
    risk_counts = {r[0]: r[1] for r in risk_res.fetchall()}

    # Recent integrity failures
    int_res = await db.execute(
        text("SELECT count(*) FROM audit_events WHERE action LIKE '%integrity%' OR status = 'FAILURE'")
    )
    integrity_failures = int_res.scalar() or 0

    stats = {
        "total_audit_events": sum(status_counts.values()),
        "status_breakdown": status_counts,
        "action_breakdown": action_counts,
        "risk_distribution": risk_counts,
        "integrity_failures": integrity_failures,
    }
    return ApiResponse(200, stats, "Audit security statistics fetched successfully")
