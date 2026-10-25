from sqlalchemy import text
from typing import Dict, Any

DEFAULT_POLICY = {
    "id": 1,
    "name": "DEFAULT",
    "version": 1,
    "download_weight": 0.25,
    "access_weight": 0.20,
    "time_weight": 0.15,
    "sensitivity_weight": 0.15,
    "sharing_weight": 0.15,
    "authentication_weight": 0.10,
    "low_max": 30.0,
    "medium_max": 60.0,
    "high_max": 80.0,
}

async def get_active_risk_policy(db) -> Dict[str, Any]:
    result = await db.execute(
        text("""
            SELECT id, name, version, download_weight, access_weight, time_weight,
                   sensitivity_weight, sharing_weight, authentication_weight,
                   low_max, medium_max, high_max
            FROM risk_policies
            WHERE is_active = TRUE
            LIMIT 1
        """)
    )
    row = result.mappings().first()
    if row:
        return {
            "id": row["id"],
            "name": row["name"],
            "version": row["version"],
            "download_weight": float(row["download_weight"]),
            "access_weight": float(row["access_weight"]),
            "time_weight": float(row["time_weight"]),
            "sensitivity_weight": float(row["sensitivity_weight"]),
            "sharing_weight": float(row["sharing_weight"]),
            "authentication_weight": float(row["authentication_weight"]),
            "low_max": float(row["low_max"]),
            "medium_max": float(row["medium_max"]),
            "high_max": float(row["high_max"]),
        }
    return DEFAULT_POLICY
