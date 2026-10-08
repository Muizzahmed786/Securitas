from fastapi import Depends
from sqlalchemy import text
from app.database import get_db
from app.utils import ApiError
from app.auth.router import verify_jwt


def require_permission(permission: str):
  async def check_permission(user=Depends(verify_jwt),db=Depends(get_db)):
    user_id = user["id"]
    result = await db.execute(
        text("""
            SELECT EXISTS (
                SELECT 1
                FROM users u
                JOIN role_permissions rp
                    ON rp.role_id = u.role_id
                JOIN permissions p
                    ON p.id = rp.permission_id
                WHERE u.id = :user_id
                  AND u.is_active = TRUE
                  AND p.name = :permission
            )
        """),
        {
            "user_id": user_id,
            "permission": permission,
        },
    )

    allowed = result.scalar_one()

    if not allowed:
        raise ApiError(403, "Permission denied")

    return user

  return check_permission