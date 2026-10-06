import os

# 1. Update Decisions.md
with open(r'd:\Projects\Securitas\Decisions.md', 'a') as f:
    f.write("""
---

## ADR-010 — Authentication Architecture (Stage 1)

**Status:** Accepted

**Date:** 2026-10-07

**Area:** Authentication / Identity

### Context

Securitas requires a robust authentication mechanism that is stateless enough to be performant but retains server-side control for revocation and explicit logouts. 

### Decision

Implement a hybrid JWT + `auth_sessions` approach.
- Authentication relies on JWTs containing explicit claims (`sub`, `jti`, `iat`, `exp`, `type`).
- A server-side `auth_sessions` table tracks every JWT by its unique `jti`.
- Secrets (e.g. `DATABASE_URL`, `SECRET_KEY`) are dynamically loaded via environment variables rather than hardcoded.
- Passwords are hashed exclusively using Argon2.
- Session revocation happens by setting `revoked_at` in the `auth_sessions` table.

### Why

Pure stateless JWTs cannot be explicitly revoked before expiration, which is unacceptable for a high-security system like Securitas. By indexing active sessions via `jti` in the database, we achieve explicit revocation while minimizing database overhead compared to traditional opaque tokens.

### Consequences

- **Positive:** Immediate session revocation upon logout or perceived threat. No hardcoded secrets.
- **Negative:** Authentication requires a database lookup to check session status.

---
""")

# 2. Update File_Contract.md
with open(r'd:\Projects\Securitas\File_Contract.md', 'a') as f:
    f.write("""

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
""")

# 3. Update Flow.md
with open(r'd:\Projects\Securitas\Flow.md', 'a') as f:
    f.write("""

## Stage 1 Authentication Flows

### Registration Flow
1. Client POSTs to `/api/auth/register` with email and strong password.
2. Server validates password policy.
3. Server checks account uniqueness (returns 409 if duplicate).
4. Server hashes password using Argon2.
5. Server assigns the default `EMPLOYEE` role.
6. DB Transaction commits atomically.
7. Server returns sanitized `UserResponse`.

### Login & Session Creation Flow
1. Client POSTs to `/api/auth/login` with email and password.
2. Server verifies user exists and Argon2 hash matches. (Generic 401 on failure).
3. Server checks if the user is active.
4. Server generates unique `jti` and sets expiration.
5. Server generates JWT with `sub`, `jti`, `iat`, `exp`, `type`.
6. Server inserts `auth_sessions` record mapping `jti` to `user_id`, capturing IP and User-Agent.
7. DB Transaction commits atomically.
8. Server returns JWT Bearer token.

### Protected Request Flow (e.g. `/me`)
1. Client sends request with `Authorization: Bearer <token>`.
2. `get_current_user` dependency intercepts request.
3. Decodes JWT and validates signature.
4. Extracts `jti` and queries `auth_sessions`.
5. Verifies session exists, `revoked_at IS NULL`, and `current time < expires_at`.
6. Returns `User` object for downstream use.

### Logout / Revocation Flow
1. Client POSTs to `/api/auth/logout` with Bearer token.
2. Server decodes JWT and extracts `jti`.
3. Server queries `auth_sessions` for that specific `jti`.
4. Server updates session setting `revoked_at = CURRENT_TIMESTAMP`.
5. Server commits to DB. Token is now permanently invalid.
""")
