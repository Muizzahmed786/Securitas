from uuid import UUID

from pydantic import BaseModel, Field


class CreateRoom(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class JoinRoom(BaseModel):
    room_id: UUID


class ShareDocument(BaseModel):
    document_id: UUID