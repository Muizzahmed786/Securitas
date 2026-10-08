-- DocSentinel: PostgreSQL 14+ initial schema. Run once in an empty database.
-- Application-managed encryption and authorization; ciphertext files live outside PostgreSQL.
-- Assumptions: one role per user; server-mediated decryption/sharing; OTP step-up.
-- AES-256-GCM storage_path contains ciphertext ONLY; nonce and tag are stored here.
-- content_hash is SHA-256 of plaintext; verify after authenticated decryption.
-- Documents are immutable uploads. Replacements receive a new document ID.
-- Keys are referenced by secret_ref; private/symmetric key material stays outside the DB.
-- Constraint names: pk_<table>, fk_<table>_<columns>, uq_<table>_<columns>,
-- ck_<table>_<column_or_rule>. Existing indexes retain their explicit names.
-- For PostgreSQL 14-17 compatibility, NOT NULL remains a column property.
-- Change it with ALTER TABLE ... ALTER COLUMN ... SET/DROP NOT NULL.
-- PostgreSQL 18+ additionally supports named NOT NULL constraints.
BEGIN;

CREATE TABLE roles (
    id BIGINT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_roles PRIMARY KEY,
    name VARCHAR(50) NOT NULL CONSTRAINT uq_roles_name UNIQUE,
    description TEXT
);

CREATE TABLE permissions (
    id BIGINT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_permissions PRIMARY KEY,
    name VARCHAR(100) NOT NULL CONSTRAINT uq_permissions_name UNIQUE,
    description TEXT
);

CREATE TABLE role_permissions (
    role_id BIGINT NOT NULL CONSTRAINT fk_role_permissions_role_id REFERENCES roles(id),
    permission_id BIGINT NOT NULL CONSTRAINT fk_role_permissions_permission_id REFERENCES permissions(id),
    CONSTRAINT pk_role_permissions PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_users PRIMARY KEY,
    email VARCHAR(254) NOT NULL CONSTRAINT ck_users_email CHECK (email = btrim(email) AND email <> ''),
    password_hash TEXT NOT NULL,
    role_id BIGINT NOT NULL CONSTRAINT fk_users_role_id REFERENCES roles(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE crypto_keys (
    id UUID CONSTRAINT pk_crypto_keys PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id BIGINT CONSTRAINT fk_crypto_keys_owner_id REFERENCES users(id), -- NULL for system-managed keys
    purpose VARCHAR(20) NOT NULL CONSTRAINT ck_crypto_keys_purpose CHECK (purpose IN ('KEY_WRAPPING', 'SIGNING', 'SEARCH')),
    algorithm VARCHAR(100) NOT NULL, -- e.g. RSA-OAEP-SHA256, ECDSA-P256-SHA256, HMAC-SHA256
    public_key_pem TEXT, -- NULL for symmetric search keys
    secret_ref TEXT NOT NULL CONSTRAINT uq_crypto_keys_secret_ref UNIQUE, -- reference to a protected key store
    status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE'
        CONSTRAINT ck_crypto_keys_status CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED', 'ROTATING')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT ck_crypto_keys_expires_after_creation CHECK (expires_at IS NULL OR expires_at > created_at),
    CONSTRAINT ck_crypto_keys_revoked_after_creation CHECK (revoked_at IS NULL OR revoked_at >= created_at),
    CONSTRAINT ck_crypto_keys_public_key_required CHECK (purpose = 'SEARCH' OR public_key_pem IS NOT NULL)
);

CREATE TABLE document_classifications (
    name VARCHAR(50) CONSTRAINT pk_document_classifications PRIMARY KEY,
    sensitivity_score SMALLINT NOT NULL CONSTRAINT ck_document_classifications_sensitivity_score CHECK (sensitivity_score BETWEEN 0 AND 100),
    description TEXT
);

CREATE TABLE documents (
    id UUID CONSTRAINT pk_documents PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id BIGINT NOT NULL CONSTRAINT fk_documents_owner_id REFERENCES users(id),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL CONSTRAINT uq_documents_storage_path UNIQUE,
    mime_type VARCHAR(255),
    file_size_bytes BIGINT NOT NULL CONSTRAINT ck_documents_file_size_bytes CHECK (file_size_bytes >= 0),
    classification VARCHAR(50) NOT NULL DEFAULT 'INTERNAL'
        CONSTRAINT fk_documents_classification REFERENCES document_classifications(name),
    encryption_algorithm VARCHAR(20) NOT NULL DEFAULT 'AES-256-GCM'
        CONSTRAINT ck_documents_encryption_algorithm CHECK (encryption_algorithm = 'AES-256-GCM'),
    encryption_nonce BYTEA NOT NULL CONSTRAINT ck_documents_encryption_nonce CHECK (octet_length(encryption_nonce) = 12),
    authentication_tag BYTEA NOT NULL CONSTRAINT ck_documents_authentication_tag CHECK (octet_length(authentication_tag) = 16),
    encrypted_dek BYTEA NOT NULL CONSTRAINT ck_documents_encrypted_dek CHECK (octet_length(encrypted_dek) > 0),
    wrapping_key_id UUID NOT NULL CONSTRAINT fk_documents_wrapping_key_id REFERENCES crypto_keys(id),
    content_hash VARCHAR(64) NOT NULL CONSTRAINT ck_documents_content_hash CHECK (content_hash ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ, -- soft deletion preserves audit references
    CONSTRAINT uq_documents_wrapped_dek_nonce UNIQUE (wrapping_key_id, encrypted_dek, encryption_nonce)
);

CREATE TABLE document_access (
    id BIGINT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_document_access PRIMARY KEY,
    document_id UUID NOT NULL CONSTRAINT fk_document_access_document_id REFERENCES documents(id),
    user_id BIGINT NOT NULL CONSTRAINT fk_document_access_user_id REFERENCES users(id),
    permission VARCHAR(10) NOT NULL CONSTRAINT ck_document_access_permission CHECK (permission IN ('READ', 'DOWNLOAD')),
    granted_by BIGINT NOT NULL CONSTRAINT fk_document_access_granted_by REFERENCES users(id),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by BIGINT CONSTRAINT fk_document_access_revoked_by REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_document_access_expires_after_creation CHECK (expires_at IS NULL OR expires_at > created_at),
    CONSTRAINT ck_document_access_revoked_after_creation CHECK (revoked_at IS NULL OR revoked_at >= created_at),
    CONSTRAINT ck_document_access_revocation_actor CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);
-- Before regranting the same permission, revoke any existing unrevoked row,
-- including an expired row. Time-dependent expiry is checked at request time.
CREATE UNIQUE INDEX document_access_unrevoked_unique
    ON document_access (document_id, user_id, permission)
    WHERE revoked_at IS NULL;

CREATE TABLE document_signatures (
    id UUID CONSTRAINT pk_document_signatures PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL CONSTRAINT fk_document_signatures_document_id REFERENCES documents(id),
    signer_id BIGINT NOT NULL CONSTRAINT fk_document_signatures_signer_id REFERENCES users(id),
    signing_key_id UUID NOT NULL CONSTRAINT fk_document_signatures_signing_key_id REFERENCES crypto_keys(id),
    signature BYTEA NOT NULL CONSTRAINT ck_document_signatures_signature CHECK (octet_length(signature) > 0),
    signature_algorithm VARCHAR(100) NOT NULL,
    signed_content_hash VARCHAR(64) NOT NULL CONSTRAINT ck_document_signatures_signed_content_hash CHECK (signed_content_hash ~ '^[0-9a-f]{64}$'),
    signed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE document_search_tokens (
    document_id UUID NOT NULL CONSTRAINT fk_document_search_tokens_document_id REFERENCES documents(id),
    search_key_id UUID NOT NULL CONSTRAINT fk_document_search_tokens_search_key_id REFERENCES crypto_keys(id),
    token BYTEA NOT NULL CONSTRAINT ck_document_search_tokens_token CHECK (octet_length(token) = 32), -- HMAC-SHA256, not plaintext
    CONSTRAINT pk_document_search_tokens PRIMARY KEY (document_id, search_key_id, token)
);
CREATE INDEX search_token_lookup ON document_search_tokens (search_key_id, token);

CREATE TABLE auth_sessions (
    id UUID CONSTRAINT pk_auth_sessions PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL CONSTRAINT fk_auth_sessions_user_id REFERENCES users(id),
    jwt_jti UUID NOT NULL CONSTRAINT uq_auth_sessions_jwt_jti UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    CONSTRAINT uq_auth_sessions_id_user_id UNIQUE (id, user_id),
    CONSTRAINT ck_auth_sessions_expires_after_creation CHECK (expires_at > created_at),
    CONSTRAINT ck_auth_sessions_revoked_after_creation CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE TABLE user_behavior_profile (
    user_id BIGINT CONSTRAINT pk_user_behavior_profile PRIMARY KEY CONSTRAINT fk_user_behavior_profile_user_id REFERENCES users(id),
    role_id_at_baseline BIGINT NOT NULL CONSTRAINT fk_user_behavior_profile_role_id_at_baseline REFERENCES roles(id),
    avg_daily_access NUMERIC(12,2) NOT NULL DEFAULT 0 CONSTRAINT ck_user_behavior_profile_avg_daily_access CHECK (avg_daily_access >= 0),
    avg_daily_download NUMERIC(12,2) NOT NULL DEFAULT 0 CONSTRAINT ck_user_behavior_profile_avg_daily_download CHECK (avg_daily_download >= 0),
    avg_daily_search NUMERIC(12,2) NOT NULL DEFAULT 0 CONSTRAINT ck_user_behavior_profile_avg_daily_search CHECK (avg_daily_search >= 0),
    avg_sharing_count NUMERIC(12,2) NOT NULL DEFAULT 0 CONSTRAINT ck_user_behavior_profile_avg_sharing_count CHECK (avg_sharing_count >= 0),
    normal_start_time TIME NOT NULL DEFAULT '09:00',
    normal_end_time TIME NOT NULL DEFAULT '18:00',
    timezone_name TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    sample_event_count BIGINT NOT NULL DEFAULT 0 CONSTRAINT ck_user_behavior_profile_sample_event_count CHECK (sample_event_count >= 0),
    is_established BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}' CONSTRAINT ck_user_behavior_profile_metadata CHECK (jsonb_typeof(metadata) = 'object'),
    baseline_updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_user_behavior_profile_baseline_window CHECK (window_end > window_start)
    -- Overnight time windows are valid; normal_end_time need not be greater.
);

CREATE TABLE risk_policies (
    id BIGINT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_risk_policies PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CONSTRAINT ck_risk_policies_version CHECK (version > 0),
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    download_weight NUMERIC(5,4) NOT NULL DEFAULT 0.25 CONSTRAINT ck_risk_policies_download_weight CHECK (download_weight BETWEEN 0 AND 1),
    access_weight NUMERIC(5,4) NOT NULL DEFAULT 0.20 CONSTRAINT ck_risk_policies_access_weight CHECK (access_weight BETWEEN 0 AND 1),
    time_weight NUMERIC(5,4) NOT NULL DEFAULT 0.15 CONSTRAINT ck_risk_policies_time_weight CHECK (time_weight BETWEEN 0 AND 1),
    sensitivity_weight NUMERIC(5,4) NOT NULL DEFAULT 0.15 CONSTRAINT ck_risk_policies_sensitivity_weight CHECK (sensitivity_weight BETWEEN 0 AND 1),
    sharing_weight NUMERIC(5,4) NOT NULL DEFAULT 0.15 CONSTRAINT ck_risk_policies_sharing_weight CHECK (sharing_weight BETWEEN 0 AND 1),
    authentication_weight NUMERIC(5,4) NOT NULL DEFAULT 0.10 CONSTRAINT ck_risk_policies_authentication_weight CHECK (authentication_weight BETWEEN 0 AND 1),
    low_max NUMERIC(5,2) NOT NULL DEFAULT 30,
    medium_max NUMERIC(5,2) NOT NULL DEFAULT 60,
    high_max NUMERIC(5,2) NOT NULL DEFAULT 80,
    high_decision VARCHAR(20) NOT NULL DEFAULT 'STEP_UP_AUTH'
        CONSTRAINT ck_risk_policies_high_decision CHECK (high_decision IN ('STEP_UP_AUTH', 'RESTRICT')),
    monitor_medium BOOLEAN NOT NULL DEFAULT TRUE,
    factor_config JSONB NOT NULL DEFAULT '{}' CONSTRAINT ck_risk_policies_factor_config CHECK (jsonb_typeof(factor_config) = 'object'),
    created_by BIGINT CONSTRAINT fk_risk_policies_created_by REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_risk_policies_name_version UNIQUE (name, version),
    CONSTRAINT ck_risk_policies_weights_sum CHECK (download_weight + access_weight + time_weight + sensitivity_weight
           + sharing_weight + authentication_weight = 1),
    CONSTRAINT ck_risk_policies_threshold_order CHECK (0 <= low_max AND low_max < medium_max AND medium_max < high_max AND high_max < 100)
);
-- At most one active policy; deployment must ensure there is one.
CREATE UNIQUE INDEX risk_policy_one_active ON risk_policies (is_active) WHERE is_active;

CREATE TABLE risk_events (
    id UUID CONSTRAINT pk_risk_events PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL,
    user_id BIGINT NOT NULL CONSTRAINT fk_risk_events_user_id REFERENCES users(id),
    document_id UUID CONSTRAINT fk_risk_events_document_id REFERENCES documents(id),
    action VARCHAR(50) NOT NULL,
    rbac_allowed BOOLEAN NOT NULL,
    policy_id BIGINT CONSTRAINT fk_risk_events_policy_id REFERENCES risk_policies(id),
    policy_snapshot JSONB NOT NULL DEFAULT '{}' CONSTRAINT ck_risk_events_policy_snapshot CHECK (jsonb_typeof(policy_snapshot) = 'object'),
    context JSONB NOT NULL DEFAULT '{}' CONSTRAINT ck_risk_events_context CHECK (jsonb_typeof(context) = 'object'),
    risk_score NUMERIC(5,2) CONSTRAINT ck_risk_events_risk_score CHECK (risk_score BETWEEN 0 AND 100),
    risk_level VARCHAR(10) CONSTRAINT ck_risk_events_risk_level CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    factors JSONB NOT NULL DEFAULT '{}' CONSTRAINT ck_risk_events_factors CHECK (jsonb_typeof(factors) = 'object'),
    decision VARCHAR(20) NOT NULL CONSTRAINT ck_risk_events_decision CHECK (decision IN ('ALLOW', 'STEP_UP_AUTH', 'RESTRICT', 'BLOCK')),
    reason TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_risk_events_id_user_id UNIQUE (id, user_id),
    CONSTRAINT ck_risk_events_rbac_denial_blocks CHECK (rbac_allowed OR decision = 'BLOCK'),
    CONSTRAINT ck_risk_events_score_level_pair CHECK ((risk_score IS NULL) = (risk_level IS NULL)),
    CONSTRAINT ck_risk_events_rbac_denial_unscored CHECK (rbac_allowed OR (risk_score IS NULL AND risk_level IS NULL)),
    CONSTRAINT ck_risk_events_scored_policy_required CHECK (risk_score IS NULL OR policy_id IS NOT NULL)
    -- NULL score supports RBAC denial and fail-safe risk-engine failure.
);

CREATE TABLE step_up_challenges (
    id UUID CONSTRAINT pk_step_up_challenges PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL CONSTRAINT fk_step_up_challenges_user_id REFERENCES users(id),
    session_id UUID NOT NULL,
    risk_event_id UUID NOT NULL,
    otp_digest BYTEA NOT NULL CONSTRAINT ck_step_up_challenges_otp_digest CHECK (octet_length(otp_digest) = 32),
    attempts INTEGER NOT NULL DEFAULT 0 CONSTRAINT ck_step_up_challenges_attempts CHECK (attempts >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 5 CONSTRAINT ck_step_up_challenges_max_attempts CHECK (max_attempts > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    invalidated_at TIMESTAMPTZ,
    CONSTRAINT fk_step_up_challenges_session_id_user_id FOREIGN KEY (session_id, user_id) REFERENCES auth_sessions(id, user_id),
    CONSTRAINT fk_step_up_challenges_risk_event_id_user_id FOREIGN KEY (risk_event_id, user_id) REFERENCES risk_events(id, user_id),
    CONSTRAINT ck_step_up_challenges_expires_after_creation CHECK (expires_at > created_at),
    CONSTRAINT ck_step_up_challenges_attempt_limit CHECK (attempts <= max_attempts),
    CONSTRAINT ck_step_up_challenges_verification_window CHECK (verified_at IS NULL OR (verified_at >= created_at AND verified_at < expires_at)),
    CONSTRAINT ck_step_up_challenges_consumption_window CHECK (consumed_at IS NULL OR
           (verified_at IS NOT NULL AND consumed_at >= verified_at AND consumed_at < expires_at))
    -- HMAC the OTP with a server secret; don't store an unkeyed hash of a short OTP.
    -- Verify/consume atomically, bound to the exact session and requested operation.
);

CREATE TABLE audit_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_audit_events PRIMARY KEY,
    request_id UUID NOT NULL,
    user_id BIGINT CONSTRAINT fk_audit_events_user_id REFERENCES users(id), -- NULL for unknown/unauthenticated actors
    document_id UUID CONSTRAINT fk_audit_events_document_id REFERENCES documents(id),
    risk_event_id UUID CONSTRAINT fk_audit_events_risk_event_id REFERENCES risk_events(id),
    action VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT ck_audit_events_status CHECK (status IN ('SUCCESS', 'FAILURE', 'DENIED', 'CHALLENGED')),
    ip_address INET,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB NOT NULL DEFAULT '{}' CONSTRAINT ck_audit_events_metadata CHECK (jsonb_typeof(metadata) = 'object')
);

-- Main lookup paths for authorization, baseline aggregation and dashboards.
CREATE INDEX users_role_idx ON users (role_id);
CREATE INDEX role_permissions_permission_idx ON role_permissions (permission_id);
CREATE INDEX crypto_keys_owner_idx ON crypto_keys (owner_id);
CREATE INDEX documents_owner_idx ON documents (owner_id) WHERE deleted_at IS NULL;
CREATE INDEX document_access_user_idx ON document_access (user_id, document_id) WHERE revoked_at IS NULL;
CREATE INDEX document_signatures_document_idx ON document_signatures (document_id);
CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id);
CREATE INDEX risk_events_user_time_idx ON risk_events (user_id, timestamp DESC);
CREATE INDEX risk_events_document_time_idx ON risk_events (document_id, timestamp DESC);
CREATE INDEX risk_events_level_time_idx ON risk_events (risk_level, timestamp DESC);
CREATE INDEX risk_events_request_idx ON risk_events (request_id);
CREATE INDEX step_up_challenges_session_idx ON step_up_challenges (session_id);
CREATE INDEX step_up_challenges_risk_idx ON step_up_challenges (risk_event_id);
CREATE INDEX audit_events_user_time_idx ON audit_events (user_id, timestamp DESC);
CREATE INDEX audit_events_document_time_idx ON audit_events (document_id, timestamp DESC);
CREATE INDEX audit_events_action_time_idx ON audit_events (action, timestamp DESC);
CREATE INDEX audit_events_request_idx ON audit_events (request_id);
CREATE INDEX audit_events_risk_idx ON audit_events (risk_event_id);

CREATE FUNCTION set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO roles (name, description) VALUES
    ('ADMIN', 'Manage users, roles, policies and configuration'),
    ('DOCUMENT_OWNER', 'Upload, manage, share and revoke owned documents'),
    ('EMPLOYEE', 'Access authorized documents'),
    ('SECURITY_AUDITOR', 'Inspect audit events and risk decisions');

-- These sensitivity scores are proposed defaults, not specified by the PRD.
INSERT INTO document_classifications (name, sensitivity_score) VALUES
    ('PUBLIC', 0), ('INTERNAL', 30), ('CONFIDENTIAL', 70), ('RESTRICTED', 100);

INSERT INTO permissions (name) VALUES
    ('users.manage'), ('roles.manage'), ('policies.manage'),
    ('documents.upload'), ('documents.read'), ('documents.download'),
    ('documents.share'), ('documents.revoke'), ('documents.sign'),
    ('documents.verify'), ('documents.delete'), ('documents.search'),
    ('audit.read'), ('risk.read');
-- Configure role_permissions explicitly before using protected endpoints.

INSERT INTO risk_policies (name, version, is_active)
VALUES ('DEFAULT', 1, TRUE);

COMMIT;

-- IMPLEMENTATION CONTRACT
-- 1. Roles govern actions; ownership/live shares govern each document. Classification
--    PUBLIC is a risk classification, not anonymous access. DOWNLOAD does not imply
--    READ unless you explicitly implement that permission hierarchy.
-- 2. Evaluate risk only after RBAC and document authorization. For fractional scores:
--    <= low_max LOW; <= medium_max MEDIUM; <= high_max HIGH; otherwise CRITICAL.
--    Validate factor scores, calculate score/level, and store policy/baseline snapshots
--    in the service. Factor JSON should hold raw score, weight, contribution, explanation.
-- 3. Expiry, key status/purpose, signer ownership and share-grant authority require
--    service checks. JWT logout works only if requests check auth_sessions.
-- 4. Verify OTP atomically; require an unexpired/unrevoked session, pending
--    STEP_UP_AUTH decision and matching action/document. Recheck authorization before
--    execution; consume once within the protected operation transaction.
-- 5. Use append-only INSERT/SELECT privileges for audit/risk events in the runtime DB
--    role; migrations use a separate owner. Schema alone is not a tamper-proof log.
-- 6. Soft-delete users/documents. Default restrictive FKs preserve historical events.
-- 7. This trusted-backend MVP wraps each document DEK once with a server-controlled
--    asymmetric key. Sharing grants permission to server-mediated decryption. A
--    recipient-decryption design instead needs per-recipient wrapped DEK records.
-- 8. Nonces must be freshly generated for each unique DEK. The UNIQUE constraint
--    catches exact stored duplicates, but cannot prove nonce/key randomness or detect
--    the same DEK wrapped differently. Crypto correctness belongs in the crypto service.
-- 9. Retain retired public keys for historical signature verification. Key expiry is
--    checked by time at runtime, not just the stored status string.
-- 10. Search HMACs leak equality/frequency; filenames/classifications/hash are plaintext
--     metadata in this MVP. Filter search results through authorization and risk.



---NEW QUERY
INSERT INTO role_permissions (role_id, permission_id)
VALUES
    -- ADMIN
    (1, 1),   -- users.manage
    (1, 2),   -- roles.manage
    (1, 3),   -- policies.manage
    (1, 4),   -- documents.upload
    (1, 5),   -- documents.read
    (1, 6),   -- documents.download
    (1, 7),   -- documents.share
    (1, 8),   -- documents.revoke
    (1, 9),   -- documents.sign
    (1, 10),  -- documents.verify
    (1, 11),  -- documents.delete
    (1, 12),  -- documents.search
    (1, 13),  -- audit.read
    (1, 14),  -- risk.read

    -- DOCUMENT_OWNER
    (2, 4),   -- documents.upload
    (2, 5),   -- documents.read
    (2, 6),   -- documents.download
    (2, 7),   -- documents.share
    (2, 8),   -- documents.revoke
    (2, 9),   -- documents.sign
    (2, 10),  -- documents.verify
    (2, 11),  -- documents.delete
    (2, 12),  -- documents.search

    -- EMPLOYEE
    (3, 5),   -- documents.read
    (3, 6),   -- documents.download
    (3, 10),  -- documents.verify
    (3, 12),  -- documents.search

    -- SECURITY_AUDITOR
    (4, 10),  -- documents.verify
    (4, 13),  -- audit.read
    (4, 14)   -- risk.read

ON CONFLICT (role_id, permission_id) DO NOTHING;
