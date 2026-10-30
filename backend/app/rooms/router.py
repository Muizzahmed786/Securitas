from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from fastapi.encoders import jsonable_encoder
from sqlalchemy import text

from app.audit.service import log_audit_event
from app.database import get_db
from app.rbac.dependency import require_permission
from app.rooms.schemas import CreateRoom, JoinRoom, ShareDocument
from app.utils.ApiError import ApiError
from app.utils.ApiResponse import ApiResponse

router = APIRouter()


async def member_room(db, room_id, user_id):
    result = await db.execute(
        text("""
            SELECT r.id, r.name, r.owner_id, r.created_at
            FROM rooms r
            JOIN room_members m ON m.room_id = r.id
            WHERE r.id = :room_id
              AND m.user_id = :user_id
        """),
        {"room_id": room_id, "user_id": user_id},
    )

    room = result.mappings().first()

    if room is None:
        raise ApiError(404, "Room not found or you have not joined it")

    return dict(room)


@router.get("")
async def list_rooms(
    user=Depends(require_permission("documents.read")),
    db=Depends(get_db),
):
    result = await db.execute(
        text("""
            SELECT r.id, r.name, r.owner_id, r.created_at
            FROM rooms r
            JOIN room_members m ON m.room_id = r.id
            WHERE m.user_id = :user_id
            ORDER BY r.created_at DESC, r.id
        """),
        {"user_id": user["id"]},
    )

    rooms = [dict(row) for row in result.mappings().all()]

    return ApiResponse(
        200,
        jsonable_encoder(rooms),
        "Rooms retrieved",
    )


@router.post("", status_code=201)
async def create_room(
    body: CreateRoom,
    user=Depends(require_permission("documents.read")),
    db=Depends(get_db),
):
    name = body.name.strip()

    if not name:
        raise ApiError(400, "Enter a room name")

    room_id = uuid4()

    result = await db.execute(
        text("""
            INSERT INTO rooms (id, name, owner_id)
            VALUES (:room_id, :name, :user_id)
            RETURNING id, name, owner_id, created_at
        """),
        {
            "room_id": room_id,
            "name": name,
            "user_id": user["id"],
        },
    )

    room = dict(result.mappings().one())

    # The creator automatically becomes a member.
    await db.execute(
        text("""
            INSERT INTO room_members (room_id, user_id)
            VALUES (:room_id, :user_id)
        """),
        {"room_id": room_id, "user_id": user["id"]},
    )

    await log_audit_event(
        db,
        action="rooms.create",
        status="SUCCESS",
        user_id=user["id"],
        metadata={"room_id": str(room_id)},
    )

    await db.commit()

    return ApiResponse(
        201,
        jsonable_encoder(room),
        "Room created",
    )


@router.post("/join")
async def join_room(
    body: JoinRoom,
    user=Depends(require_permission("documents.read")),
    db=Depends(get_db),
):
    result = await db.execute(
        text("""
            SELECT id, name, owner_id, created_at
            FROM rooms
            WHERE id = :room_id
        """),
        {"room_id": body.room_id},
    )

    room = result.mappings().first()

    if room is None:
        raise ApiError(404, "Room not found. Check the room ID")

    room = dict(room)

    result = await db.execute(
        text("""
            INSERT INTO room_members (room_id, user_id)
            VALUES (:room_id, :user_id)
            ON CONFLICT (room_id, user_id) DO NOTHING
            RETURNING user_id
        """),
        {
            "room_id": body.room_id,
            "user_id": user["id"],
        },
    )

    if result.first() is not None:
        await log_audit_event(
            db,
            action="rooms.join",
            status="SUCCESS",
            user_id=user["id"],
            metadata={"room_id": str(body.room_id)},
        )

    await db.commit()

    return ApiResponse(
        200,
        jsonable_encoder(room),
        "Room joined",
    )


@router.get("/{room_id}")
async def get_room(
    room_id: UUID,
    user=Depends(require_permission("documents.read")),
    db=Depends(get_db),
):
    room = await member_room(db, room_id, user["id"])

    result = await db.execute(
        text("""
            SELECT
                d.id,
                d.filename,
                d.classification,
                d.file_size_bytes,
                d.owner_id,
                rd.shared_at
            FROM room_documents rd
            JOIN documents d ON d.id = rd.document_id
            WHERE rd.room_id = :room_id
              AND d.deleted_at IS NULL
              AND rd.shared_by = d.owner_id
              AND (
                  d.owner_id = :user_id

                  OR EXISTS (
                      SELECT 1
                      FROM document_access a
                      WHERE a.document_id = d.id
                        AND a.user_id = :user_id
                        AND a.revoked_at IS NULL
                        AND (
                            a.expires_at IS NULL
                            OR a.expires_at > CURRENT_TIMESTAMP
                        )
                  )

                  OR NOT EXISTS (
                      SELECT 1
                      FROM document_access a
                      WHERE a.document_id = d.id
                        AND a.user_id = :user_id
                  )
              )
            ORDER BY rd.shared_at DESC, d.id
        """),
        {
            "room_id": room_id,
            "user_id": user["id"],
        },
    )

    room["documents"] = [
        dict(row) for row in result.mappings().all()
    ]

    return ApiResponse(
        200,
        jsonable_encoder(room),
        "Room retrieved",
    )


@router.post("/{room_id}/documents")
async def share_document_in_room(
    room_id: UUID,
    body: ShareDocument,
    user=Depends(require_permission("documents.share")),
    db=Depends(get_db),
):
    await member_room(db, room_id, user["id"])

    result = await db.execute(
        text("""
            SELECT id, owner_id
            FROM documents
            WHERE id = :document_id
              AND deleted_at IS NULL
            FOR SHARE
        """),
        {"document_id": body.document_id},
    )

    document = result.mappings().first()

    if document is None or document["owner_id"] != user["id"]:
        raise ApiError(
            403,
            "You can only share your own active documents",
        )

    result = await db.execute(
        text("""
            INSERT INTO room_documents (
                room_id,
                document_id,
                shared_by
            )
            VALUES (
                :room_id,
                :document_id,
                :user_id
            )
            ON CONFLICT (room_id, document_id) DO NOTHING
            RETURNING document_id
        """),
        {
            "room_id": room_id,
            "document_id": body.document_id,
            "user_id": user["id"],
        },
    )

    if result.first() is not None:
        await log_audit_event(
            db,
            action="rooms.share",
            status="SUCCESS",
            user_id=user["id"],
            document_id=body.document_id,
            metadata={"room_id": str(room_id)},
        )

    await db.commit()

    return ApiResponse(
        200,
        {"document_id": str(body.document_id)},
        "Document shared",
    )