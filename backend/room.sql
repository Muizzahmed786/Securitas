BEGIN;

CREATE TABLE rooms (
    id UUID PRIMARY KEY,
    name VARCHAR(80) NOT NULL CHECK (length(trim(name)) > 0),
    owner_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE room_members (
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id, user_id)
);

CREATE TABLE room_documents (
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id),
    shared_by BIGINT NOT NULL REFERENCES users(id),
    shared_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (room_id, document_id),

    FOREIGN KEY (room_id, shared_by)
        REFERENCES room_members(room_id, user_id)
);

CREATE INDEX room_members_user_idx
    ON room_members(user_id, room_id);

CREATE INDEX room_documents_document_idx
    ON room_documents(document_id);

COMMIT;