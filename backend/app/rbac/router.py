from fastapi import APIRouter,Depends
from sqlalchemy import text
from app.auth.router import verify_jwt
from app.database import get_db
from app.utils.ApiResponse import ApiResponse
router=APIRouter()

@router.get("/get-my-permissions")
async def get_my_permissions(
    user=Depends(verify_jwt),
    db=Depends(get_db),
):
    role_id = user["role_id"]

    result = await db.execute(
        text("""
            SELECT p.id, p.name, p.description
            FROM role_permissions rp
            JOIN permissions p ON p.id = rp.permission_id
            WHERE rp.role_id = :role_id
            ORDER BY p.id
        """),
        {"role_id": role_id},
    )

    permissions = [
        dict(row) for row in result.mappings().all()
    ]

    return ApiResponse(
        200,
        {"permissions": permissions},
        "Permissions fetched successfully",
    )
  