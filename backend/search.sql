BEGIN;
-- Existing document_search_tokens and crypto_keys tables are reused.
CREATE TABLE IF NOT EXISTS document_search_status (
    document_id UUID CONSTRAINT pk_document_search_status PRIMARY KEY
        CONSTRAINT fk_document_search_status_document REFERENCES documents(id),
    search_key_id UUID CONSTRAINT fk_document_search_status_key REFERENCES crypto_keys(id),
    state VARCHAR(20) NOT NULL CONSTRAINT ck_document_search_status_state
        CHECK (state IN ('INDEXED', 'UNSUPPORTED', 'EMPTY', 'FAILED')),
    token_count INTEGER NOT NULL DEFAULT 0 CONSTRAINT ck_document_search_status_count CHECK (token_count >= 0),
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS search_challenge_context (
    challenge_id UUID CONSTRAINT pk_search_challenge_context PRIMARY KEY
        CONSTRAINT fk_search_challenge_context_challenge REFERENCES step_up_challenges(id),
    query_binding VARCHAR(64) NOT NULL
        CONSTRAINT ck_search_challenge_context_binding CHECK (query_binding ~ '^[0-9a-f]{64}$')
);
INSERT INTO permissions (name) VALUES ('documents.search') ON CONFLICT (name) DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name IN ('DOCUMENT_OWNER', 'OWNER', 'EMPLOYEE') AND p.name = 'documents.search'
ON CONFLICT DO NOTHING;
COMMIT;
