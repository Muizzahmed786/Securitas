> Progress-check update: the implemented milestone is registration/login/logout,
> revocable sessions, owner-only encrypted upload/list/download, and the React UI.
> The current source uses bcrypt and JSON auth endpoints. Older Stage 1 plans
> below are historical targets where they disagree with these implementations.
> Standalone hash verification, signatures, sharing, search, risk and tamper demos
> are deferred. AES-GCM still validates its authentication tag on decryption.

# Securitas File Contracts (`File_Contract.md`)

This document is the **contract and reference for every important source file in Securitas**. 

It outlines the responsibilities, inputs, outputs, dependencies, security requirements, and architectural invariants of core files. **This document must describe the actual implementation, not just the intended architecture**, though files that are not yet implemented are marked as `Planned`.

---

## `backend/app/crypto/encryption.py`

**Status:** Planned

### Purpose

To provide AES-GCM encryption and decryption functions for document content and manage the secure handling of per-document data-encryption keys (DEKs).

### Responsibility

- Encrypt document streams/bytes using AES-GCM.
- Decrypt document streams/bytes using AES-GCM.
- Generate secure random DEKs.
- Ensure authentication tags are verified upon decryption.

### Inputs

| Input | Type | Source | Required | Description |
|---|---|---|---|---|
| plaintext | bytes | Document Upload Service | Yes | Raw document content to be encrypted. |
| ciphertext | bytes | Storage Service | Yes | Encrypted document content to be decrypted. |
| dek | bytes | Key Management Service | Yes | The data encryption key for AES. |

### Outputs

| Output | Type | Consumer | Description |
|---|---|---|---|
| ciphertext | bytes | Storage Service | The AES-GCM encrypted document content. |
| plaintext | bytes | Document Download Service | The decrypted original document content. |
| tag | bytes | Storage Service | AES-GCM authentication tag for integrity check during decryption. |

### Public Interface

```text
encrypt_document(data, public_key_pem, document_id) → {ciphertext, nonce, authentication_tag, encrypted_dek, content_hash}
decrypt_document(ciphertext, metadata, private_key) → plaintext
```

### Dependencies

| Dependency | Why It Is Used |
|---|---|
| `cryptography.hazmat` | Underlying cryptographic primitives for AES-GCM. |
| `os.urandom` / `secrets` | CSPRNG for DEK and nonce generation. |

### Dependants

| Consumer | How It Uses This File |
|---|---|
| `backend/app/documents/service.py` | Calls encryption during upload and decryption during download. |

### Data / Database Interaction

Does not interact directly with the database. Relies on the caller to persist the ciphertext, tag, and protected DEK.

### Security Responsibilities

- `<Cryptography>` Performs AES-GCM encryption and ensures nonce uniqueness and tag validation.

### Error / Failure Behaviour

| Condition | Behaviour |
|---|---|
| Invalid tag during decryption | Raise `IntegrityError` / `DecryptionError`. |
| Invalid key size | Raise `ValueError`. |

### Contract Invariants

The following must remain true:

- This module must *never* store or log DEKs or plaintext document contents.
- AES-GCM must *always* use a unique, randomly generated nonce for every encryption operation.
- Decryption must *always* verify the authentication tag before releasing any plaintext.

### Related Flows

- `FLOW-15 — AES encryption`
- `FLOW-19 — Document decryption`

### Change Impact

Changes to the algorithm (e.g., from AES-GCM to ChaCha20-Poly1305) will break backwards compatibility for all existing encrypted documents unless a key-versioning / algorithm-negotiation scheme is implemented.

---

## `backend/app/risk/scorer.py`

**Status:** Planned

### Purpose

To calculate a normalized contextual risk score based on various weighted risk factors for a given user action and context.

### Responsibility

- Accept a unified risk context.
- Execute all registered risk factors (e.g., download anomaly, time anomaly).
- Aggregate factor outputs according to defined weights.
- Output a final risk score (0-100) and explanations.

### Inputs

| Input | Type | Source | Required | Description |
|---|---|---|---|---|
| context | RiskContext | `context_builder.py` | Yes | The aggregated context including user baseline and current action metadata. |

### Outputs

| Output | Type | Consumer | Description |
|---|---|---|---|
| score | int | `policies.py` | The aggregated risk score (0-100). |
| factors | dict | `policies.py` / `audit.py` | Breakdown of individual factor scores and explanations. |

### Public Interface

```text
calculate_risk(context: RiskContext) → RiskResult
```

### Dependencies

| Dependency | Why It Is Used |
|---|---|
| `backend/app/risk/factors.py` | Provides the individual anomaly detection algorithms. |

### Dependants

| Consumer | How It Uses This File |
|---|---|
| `backend/app/risk/service.py` | Calls `calculate_risk` during the authorization pipeline. |

### Data / Database Interaction

No direct database interaction. Relies on the input `RiskContext` which is already populated from the database.

### Security Responsibilities

- `<Risk evaluation>` Core logic for combining risk signals into an actionable score.

### Error / Failure Behaviour

| Condition | Behaviour |
|---|---|
| Missing factor data | Default factor score to a safe fallback (e.g., 0 or configurable) and log warning. |
| Factor execution fails | Catch exception, log error, and bypass factor or fail-closed based on configuration. |

### Contract Invariants

The following must remain true:

- This function always returns a normalized risk score between 0 and 100.
- The scorer must be deterministic given the exact same `RiskContext`.
- The scorer must not execute any state-changing operations (pure function).

### Related Flows

- `FLOW-40 — Risk-score calculation`

### Change Impact

Changes to the factor weights or aggregation logic will shift the overall risk distribution, potentially causing an increase in false positives (blocks) or false negatives (allows). Policies may need to be retuned.

---

## `backend/app/documents/router.py`

**Status:** Planned

### Purpose

To provide the external HTTP REST API endpoints for document lifecycle operations (upload, download, view).

### Responsibility

- Define HTTP routes and methods for documents.
- Parse and validate incoming request payloads.
- Invoke authentication and authorization dependencies.
- Delegate business logic to the document service.
- Return standardized HTTP responses and status codes.

### Inputs

| Input | Type | Source | Required | Description |
|---|---|---|---|---|
| HTTP Request | HTTP | Client | Yes | Includes headers, path parameters, and body. |

### Outputs

| Output | Type | Consumer | Description |
|---|---|---|---|
| HTTP Response | HTTP | Client | JSON payloads or binary file streams. |

### Public Interface

```text
POST /api/documents → Upload document
GET /api/documents/{id}/download → Download document
GET /api/documents/{id} → Get document metadata
```

### Dependencies

| Dependency | Why It Is Used |
|---|---|
| `fastapi` | Web framework routing and dependency injection. |
| `backend/app/auth/dependencies.py` | To extract and validate the JWT. |
| `backend/app/rbac/dependencies.py` | To enforce role-based access. |
| `backend/app/risk/service.py` | To evaluate risk prior to sensitive operations. |
| `backend/app/documents/service.py` | Core business logic for documents. |

### Dependants

| Consumer | How It Uses This File |
|---|---|
| Frontend API Client | Makes HTTP calls to these routes. |

### Data / Database Interaction

None directly; delegates to `service.py`.

### Security Responsibilities

- `<Authentication>` Enforced via FastAPI dependencies on all routes.
- `<Authorization>` Enforced via RBAC dependencies on all routes.
- `<Validation>` Schema validation via Pydantic models.
- `<Risk evaluation>` Invoked for high-sensitivity endpoints (e.g., download).

### Error / Failure Behaviour

| Condition | Behaviour |
|---|---|
| Unauthorized | 401 Unauthorized |
| RBAC / Risk Denied | 403 Forbidden |
| Document Not Found | 404 Not Found |
| Invalid Schema | 422 Unprocessable Entity |

### Contract Invariants

The following must remain true:

- Every endpoint must require an authenticated user.
- Every endpoint returning document content must evaluate RBAC and Risk before responding.
- Exceptions thrown by services must be caught and translated to safe HTTP error responses, never leaking stack traces or internal structure.

### Related Flows

- `FLOW-13 — Document upload`
- `FLOW-18 — Document retrieval`

### Change Impact

Changes to route paths, methods, or request/response schemas will break API contracts with the frontend and require corresponding updates in the frontend API client.

---

*(Note: Additional files will be documented here as they are implemented in the codebase.)*


## Stage 1 Authentication Contracts

### `app/config.py`
- **Purpose**: Manage environment configurations securely.
- **Responsibilities**: Dynamically load `DATABASE_URL` and `SECRET_KEY`.
- **Invariants**: Must not contain hardcoded default secrets.

### `app/auth/schemas.py`
- **Purpose**: Pydantic validation for Auth.
- **Responsibilities**: Enforce strict password complexity for registration; sanitize user output.
- **Invariants**: `UserResponse` must never expose `password_hash`. Client cannot assign `role_id` via `UserCreate`.

### `app/auth/security.py`
- **Purpose**: Cryptographic utilities.
- **Responsibilities**: Argon2 password hashing; JWT generation/decoding.
- **Invariants**: JWTs must include `sub`, `jti`, `iat`, `exp`, `type`.

### `app/auth/dependencies.py`
- **Purpose**: Identity resolution for protected routes.
- **Responsibilities**: Extract token, decode, query `auth_sessions` by `jti`, verify session validity (`revoked_at IS NULL` AND not expired), return active User.
- **Invariants**: Must raise 401 on any failure to validate cryptographic signature or server-side DB session. Separated from Authorization (RBAC).

### `app/auth/router.py`
- **Purpose**: Authentication API endpoints.
- **Responsibilities**: Registration (assigns default role), Login (creates session, captures IP/User-Agent), Logout (revokes session), `/me` (fetches active user profile).
- **Invariants**: Login failures return generic "Invalid credentials". Endpoints use strict atomic DB transactions.
