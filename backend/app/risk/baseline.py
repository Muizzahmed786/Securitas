from datetime import time, datetime, timezone
from sqlalchemy import text
from typing import Dict, Any

DEFAULT_BASELINE = {
    "avg_daily_access": 5.0,
    "avg_daily_download": 2.0,
    "avg_daily_search": 3.0,
    "normal_start_time": time(8, 0, 0),
    "normal_end_time": time(18, 0, 0),
    "avg_sharing_count": 1.0,
}

async def get_or_create_user_baseline(db, user_id: int) -> Dict[str, Any]:
    result = await db.execute(
        text("""
            SELECT user_id, role_id_at_baseline, avg_daily_access, avg_daily_download, avg_daily_search,
                   normal_start_time, normal_end_time, avg_sharing_count, baseline_updated_at
            FROM user_behavior_profile
            WHERE user_id = :user_id
        """),
        {"user_id": user_id}
    )
    row = result.mappings().first()
    if row:
        return dict(row)

    # Look up user's role_id for foreign key constraint
    user_res = await db.execute(
        text("SELECT role_id FROM users WHERE id = :user_id"),
        {"user_id": user_id}
    )
    user_row = user_res.mappings().first()
    role_id = user_row["role_id"] if user_row and user_row.get("role_id") else 3

    # Insert default baseline for cold start
    await db.execute(
        text("""
            INSERT INTO user_behavior_profile (
                user_id, role_id_at_baseline, avg_daily_access, avg_daily_download, avg_daily_search,
                normal_start_time, normal_end_time, avg_sharing_count,
                window_start, window_end, baseline_updated_at
            ) VALUES (
                :user_id, :role_id, 5.0, 2.0, 3.0, '08:00:00', '18:00:00', 1.0,
                CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            ON CONFLICT (user_id) DO NOTHING
        """),
        {"user_id": user_id, "role_id": role_id}
    )
    await db.commit()
    return {
        "user_id": user_id,
        "role_id_at_baseline": role_id,
        **DEFAULT_BASELINE,
        "baseline_updated_at": datetime.now(timezone.utc)
    }
