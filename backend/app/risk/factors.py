from datetime import datetime, timedelta
from sqlalchemy import text
from app.risk.schemas import RiskContext, FactorEvaluation

CLASSIFICATION_SCORES = {
    "PUBLIC": 0.0,
    "INTERNAL": 30.0,
    "CONFIDENTIAL": 70.0,
    "RESTRICTED": 100.0,
}

async def evaluate_download_anomaly(context: RiskContext, baseline: dict, db, weight: float) -> FactorEvaluation:
    since = context.timestamp - timedelta(hours=24)
    result = await db.execute(
        text("""
            SELECT COUNT(*) FROM audit_events
            WHERE user_id = :user_id
              AND action = 'documents.download'
              AND status = 'SUCCESS'
              AND timestamp >= :since
        """),
        {"user_id": context.user_id, "since": since}
    )
    count = result.scalar() or 0
    # Include current download if action is download
    if context.action in ("documents.download", "download"):
        count += 1

    avg_daily = float(baseline.get("avg_daily_download", 2.0))
    if count <= avg_daily:
        score = 0.0
        explanation = f"Daily downloads ({count}) within baseline ({avg_daily:.1f})."
    else:
        excess = count - avg_daily
        ratio = excess / max(avg_daily, 1.0)
        score = min(100.0, ratio * 35.0)
        explanation = f"Download anomaly detected: {count} downloads in 24h exceeds baseline of {avg_daily:.1f}."

    return FactorEvaluation(
        score=round(score, 2),
        weight=weight,
        weighted_score=round(score * weight, 2),
        explanation=explanation,
        metadata={"downloads_24h": count, "baseline_avg": avg_daily}
    )


async def evaluate_access_frequency_anomaly(context: RiskContext, baseline: dict, db, weight: float) -> FactorEvaluation:
    since = context.timestamp - timedelta(hours=1)
    result = await db.execute(
        text("""
            SELECT COUNT(*) FROM audit_events
            WHERE user_id = :user_id
              AND timestamp >= :since
        """),
        {"user_id": context.user_id, "since": since}
    )
    count = result.scalar() or 0
    count += 1  # include current request

    avg_daily = float(baseline.get("avg_daily_access", 5.0))
    hourly_baseline = max(avg_daily / 8.0, 2.0)

    if count <= hourly_baseline:
        score = 0.0
        explanation = f"Hourly access frequency ({count}) within expected baseline."
    else:
        excess = count - hourly_baseline
        score = min(100.0, (excess / hourly_baseline) * 40.0)
        explanation = f"High access frequency: {count} actions in past hour exceeds normal rate ({hourly_baseline:.1f}/hr)."

    return FactorEvaluation(
        score=round(score, 2),
        weight=weight,
        weighted_score=round(score * weight, 2),
        explanation=explanation,
        metadata={"actions_1h": count, "hourly_baseline": hourly_baseline}
    )


async def evaluate_time_anomaly(context: RiskContext, baseline: dict, db, weight: float) -> FactorEvaluation:
    req_time = context.timestamp.time()
    start_time = baseline.get("normal_start_time")
    end_time = baseline.get("normal_end_time")

    if hasattr(start_time, "hour"):
        start_hour = start_time.hour
    else:
        start_hour = 8

    if hasattr(end_time, "hour"):
        end_hour = end_time.hour
    else:
        end_hour = 18

    current_hour = req_time.hour

    if start_hour <= current_hour <= end_hour:
        score = 0.0
        explanation = f"Operation requested within normal operating hours ({start_hour:02d}:00 - {end_hour:02d}:00)."
    elif current_hour in range(0, 5) or current_hour >= 23:
        score = 85.0
        explanation = f"Unusual off-hours access: Operation requested during late night/early morning ({current_hour:02d}:{req_time.minute:02d})."
    else:
        score = 50.0
        explanation = f"Off-hours access: Operation requested outside standard business window ({current_hour:02d}:{req_time.minute:02d})."

    return FactorEvaluation(
        score=round(score, 2),
        weight=weight,
        weighted_score=round(score * weight, 2),
        explanation=explanation,
        metadata={"current_hour": current_hour, "window": f"{start_hour:02d}:00-{end_hour:02d}:00"}
    )


async def evaluate_document_sensitivity(context: RiskContext, baseline: dict, db, weight: float) -> FactorEvaluation:
    classification = (context.document_classification or "INTERNAL").upper()
    score = CLASSIFICATION_SCORES.get(classification, 30.0)

    if score >= 70.0:
        explanation = f"High document sensitivity classification: {classification} ({score:.0f}/100)."
    elif score > 0:
        explanation = f"Standard document sensitivity classification: {classification} ({score:.0f}/100)."
    else:
        explanation = f"Public document sensitivity classification: {classification} (0/100)."

    return FactorEvaluation(
        score=round(score, 2),
        weight=weight,
        weighted_score=round(score * weight, 2),
        explanation=explanation,
        metadata={"classification": classification}
    )


async def evaluate_sharing_anomaly(context: RiskContext, baseline: dict, db, weight: float) -> FactorEvaluation:
    since = context.timestamp - timedelta(hours=24)
    result = await db.execute(
        text("""
            SELECT COUNT(*) FROM audit_events
            WHERE user_id = :user_id
              AND action = 'documents.share'
              AND timestamp >= :since
        """),
        {"user_id": context.user_id, "since": since}
    )
    count = result.scalar() or 0
    if context.action in ("documents.share", "share"):
        count += 1

    avg_sharing = float(baseline.get("avg_sharing_count", 1.0))

    if count <= avg_sharing:
        score = 0.0
        explanation = f"Sharing volume ({count}) within baseline."
    else:
        excess = count - avg_sharing
        score = min(100.0, (excess / max(avg_sharing, 1.0)) * 50.0)
        explanation = f"Sharing frequency anomaly: {count} shares in 24h exceeds baseline of {avg_sharing:.1f}."

    return FactorEvaluation(
        score=round(score, 2),
        weight=weight,
        weighted_score=round(score * weight, 2),
        explanation=explanation,
        metadata={"shares_24h": count, "baseline_avg": avg_sharing}
    )


async def evaluate_authentication_anomaly(context: RiskContext, baseline: dict, db, weight: float) -> FactorEvaluation:
    since = context.timestamp - timedelta(hours=24)
    result = await db.execute(
        text("""
            SELECT COUNT(*) FROM audit_events
            WHERE user_id = :user_id
              AND action = 'auth.login'
              AND status = 'FAILURE'
              AND timestamp >= :since
        """),
        {"user_id": context.user_id, "since": since}
    )
    failed_logins = result.scalar() or 0

    if failed_logins == 0:
        score = 0.0
        explanation = "Clean authentication history: 0 failed login attempts in past 24 hours."
    elif failed_logins <= 2:
        score = 40.0
        explanation = f"Minor authentication anomaly: {failed_logins} failed login attempt(s) detected in past 24 hours."
    else:
        score = 100.0
        explanation = f"Severe authentication anomaly: {failed_logins} failed login attempts detected in past 24 hours."

    return FactorEvaluation(
        score=round(score, 2),
        weight=weight,
        weighted_score=round(score * weight, 2),
        explanation=explanation,
        metadata={"failed_logins_24h": failed_logins}
    )
