# DocSentinel --- Product Requirements Document

**Project:** DocSentinel: An Adaptive Risk-Based Secure Document
Management and Access Control System\
**Type:** Information Security Laboratory Project\
**Status:** Implementation Plan

## 1. Executive Summary

DocSentinel is a secure document-management platform combining
authentication, RBAC, AES document encryption, asymmetric key
protection, SHA-256 integrity verification, digital signatures,
controlled sharing, expiration/revocation, protected search, audit
logging, and an adaptive risk engine.

The key architectural rule is:

``` text
Authentication → RBAC → Context Builder → Risk Engine → Decision → Document Operation → Audit
```

RBAC remains the first authorization boundary. The Risk Engine can
further restrict an RBAC-approved operation, but it must never grant
access that RBAC denied.

## 2. Source Alignment

The existing project synopsis covers secure document storage, AES,
RSA/ECC-based key protection, SHA-256, digital signatures, controlled
sharing, expiration/revocation, searchable encryption, RBAC, and
security audit logging. The lab manuals also cover asymmetric
cryptography, key management, hashing, digital signatures, RBAC, ABAC,
time-based access control, probabilistic access control, and searchable
encryption. The adaptive risk engine is an extension of that foundation
rather than a replacement for it.

## 3. Objectives

-   Securely authenticate users.
-   Implement RBAC for static authorization.
-   Encrypt documents at rest using AES.
-   Protect document keys using asymmetric cryptography.
-   Verify integrity with SHA-256.
-   Support digital signatures and verification.
-   Provide controlled sharing, expiration, and revocation.
-   Provide protected document search.
-   Log all security-sensitive operations.
-   Build user behavioural baselines.
-   Calculate contextual risk scores for sensitive actions.
-   Dynamically allow, step-up, restrict, or block operations.
-   Provide an auditor dashboard explaining security decisions.

## 4. Users and Roles

  -----------------------------------------------------------------------
  Role                                Responsibility
  ----------------------------------- -----------------------------------
  Admin                               Users, roles, policies, system
                                      configuration

  Document Owner                      Upload, manage, share and revoke
                                      owned documents

  Employee                            Access documents according to
                                      permissions

  Security Auditor                    Inspect audit events, risk events
                                      and security decisions
  -----------------------------------------------------------------------

A role influences expected behaviour but must not automatically make the
user low-risk.

## 5. Functional Scope

### Identity and authorization

-   Registration/login
-   Password hashing
-   JWT authentication
-   RBAC and permission checks

### Document security

-   Secure upload and validation
-   AES-GCM document encryption
-   Per-document data-encryption keys
-   RSA/ECC-based key protection
-   SHA-256 integrity hashes
-   Digital signatures and verification
-   Document sensitivity classification

### Sharing

-   User-to-user sharing
-   Read/download permissions
-   Expiration
-   Revocation

### Search and audit

-   Authorized protected search
-   Audit events for login, upload, view, download, search, share,
    revoke, signing, verification and integrity failures

### Adaptive risk

-   Behavioural baseline
-   Context extraction
-   Six weighted risk factors
-   0--100 risk score
-   LOW/MEDIUM/HIGH/CRITICAL levels
-   ALLOW/STEP-UP/RESTRICT/BLOCK decisions
-   Explainable factors and risk events

## 6. MVP / Out of Scope

### Must Have

-   Authentication
-   RBAC
-   PostgreSQL persistence
-   AES document encryption
-   Key protection
-   SHA-256 integrity
-   Digital signatures
-   Sharing
-   Expiration and revocation
-   Audit logging
-   Basic protected search
-   Behavioural baseline
-   Rule-based risk engine
-   Adaptive access decisions

### Out of Scope

-   Deep-learning UEBA
-   Blockchain
-   Fully homomorphic encryption
-   Hardware security modules
-   Distributed storage
-   Enterprise SSO
-   Device fingerprinting
-   Network traffic inspection
-   Geolocation intelligence
-   Autonomous permanent account termination
-   Post-quantum cryptography

## 7. Architecture

``` text
React + Tailwind + Vite
          ↓ HTTPS
FastAPI API Layer
          ↓
Authentication / JWT
          ↓
RBAC Authorization
          ↓
Risk Context Builder
          ↓
Risk Engine
 ┌────────┼───────────────┐
 │        │               │
Baseline Factors      Policy
 └────────┼───────────────┘
          ↓
Decision: ALLOW / STEP-UP / RESTRICT / BLOCK
          ↓
Document Crypto: AES / Key Protection / Hash / Signature
          ↓
PostgreSQL + Encrypted File Storage
          ↓
Audit Logging → Auditor Dashboard
```

## 8. Technology Stack

### Frontend

-   React.js
-   Vite
-   Tailwind CSS
-   React Router
-   Axios
-   Zustand
-   Recharts
-   Lucide React

### Backend

-   Python
-   FastAPI
-   Pydantic v2
-   SQLAlchemy 2.x
-   Alembic
-   `cryptography`
-   JWT library
-   Argon2 or bcrypt-compatible password hashing
-   python-multipart
-   pytest
-   httpx

### Data and infrastructure

-   PostgreSQL
-   Local encrypted file/object storage abstraction
-   Git/GitHub for version control

## 9. Database Model

### users

`id, email, password_hash, role_id, is_active, created_at, updated_at`

### roles

`id, name, description`

### permissions

`id, name, description`

### role_permissions

`role_id, permission_id`

### documents

`id, owner_id, filename, storage_path, classification, encrypted_dek, content_hash, signature, signature_algorithm, created_at, updated_at`

### document_access

`id, document_id, user_id, permission, granted_by, expires_at, revoked_at, created_at`

### audit_events

`id, user_id, document_id, action, status, ip_address, timestamp, metadata`

### user_behavior_profile

`user_id, role, avg_daily_access, avg_daily_download, avg_daily_search, normal_start_time, normal_end_time, avg_sharing_count, baseline_updated_at`

### risk_events

`id, user_id, document_id, action, risk_score, risk_level, factors, decision, timestamp`

## 10. Cryptographic Design

### Document encryption

Use a unique random data-encryption key (DEK) per document:

``` text
Document → AES-GCM(DEK) → Ciphertext
DEK → asymmetric protection → Encrypted DEK
```

The asymmetric algorithm protects the key; it should not be used to
encrypt large files directly.

### Integrity

``` text
Document → SHA-256 → Digest
```

Recompute and compare the digest during integrity verification.

### Digital signature

``` text
Document → SHA-256 → Digest → Private Signing Key → Signature
```

Verify using the corresponding public key.

## 11. Risk Engine

### Factors and weights

  Factor                       Weight
  -------------------------- --------
  Download anomaly                25%
  Access-frequency anomaly        20%
  Time anomaly                    15%
  Document sensitivity            15%
  Sharing anomaly                 15%
  Authentication anomaly          10%

Each factor returns a normalized value from 0--100.

``` text
Risk Score =
  0.25 × Download Anomaly
+ 0.20 × Access Frequency Anomaly
+ 0.15 × Time Anomaly
+ 0.15 × Document Sensitivity
+ 0.15 × Sharing Anomaly
+ 0.10 × Authentication Anomaly
```

### Risk levels

      Score Level
  --------- ----------
      0--30 LOW
     31--60 MEDIUM
     61--80 HIGH
    81--100 CRITICAL

### Decision policy

  Level      Default decision
  ---------- -------------------------
  LOW        ALLOW
  MEDIUM     ALLOW / MONITOR
  HIGH       STEP-UP AUTH / RESTRICT
  CRITICAL   BLOCK

Thresholds must be configurable.

## 12. Behavioural Baseline

The initial baseline should use a defined historical window such as the
previous 30 days and calculate:

-   Average daily accesses
-   Average daily downloads
-   Average daily searches
-   Normal access-time window
-   Average sharing count
-   Role/context metadata

The baseline must not immediately absorb anomalous activity; otherwise
an attacker could train the system to consider malicious behaviour
normal.

## 13. Document Sensitivity

Use configurable classifications:

``` text
PUBLIC
INTERNAL
CONFIDENTIAL
RESTRICTED
```

Sensitivity contributes to risk but does not independently determine
authorization.

## 14. Detailed Implementation Stages

### Stage 0 --- Foundation

**Goal:** Establish a reproducible repository and architecture.

Tasks: - Create frontend/backend structure. - Configure environment
variables and `.env.example`. - Configure PostgreSQL and migrations. -
Add health endpoint. - Set up Git workflow and
documentation.

**Exit:** Frontend, backend and database run locally and migrations
succeed.

### Stage 1 --- Authentication

Tasks: - Registration. - Secure password hashing. - Login. - JWT
creation and validation. - Protected API dependency. - Authentication
failure logging.

**Exit:** Users can register/login and protected routes reject
unauthenticated requests.

### Stage 2 --- RBAC

Tasks: - Create roles and permissions. - Implement role-permission
mapping. - Add authorization dependencies. - Protect every document
endpoint.

**Exit:** Direct API calls cannot bypass RBAC.

### Stage 3 --- Secure Document Upload

Tasks: - File validation and size limits. - Secure file naming/storage
abstraction. - Generate per-document DEK. - AES-GCM encryption. - Store
encrypted document and metadata. - Protect DEK.

**Exit:** Persistent document storage contains encrypted content, not
plaintext uploads.

### Stage 4 --- Key Management

Tasks: - Public/private key lifecycle. - DEK protection. - Key metadata
and status. - Expiry and revocation metadata. - Dedicated key-management
service.

Key states: `ACTIVE`, `EXPIRED`, `REVOKED`, `ROTATING`.

**Exit:** Private keys are not exposed through normal API responses and
key lifecycle is testable.

### Stage 5 --- SHA-256 Integrity

Tasks: - Hash on upload. - Store digest. - Recalculate during
access/download. - Detect mismatch. - Create integrity-failure audit
event.

**Exit:** Controlled tampering is detected.

### Stage 6 --- Digital Signatures

Tasks: - Generate signing key pair. - Sign document digest. - Store
signature metadata. - Verify signatures. - Log signature and
verification events.

**Exit:** UI clearly reports valid, invalid or unsigned state.

### Stage 7 --- Sharing, Expiration and Revocation

Tasks: - Share with a selected user. - Assign permission. - Store
expiration. - Revoke access. - Enforce both expiration and revocation at
request time. - Audit each operation.

**Exit:** Expired/revoked users cannot access previously shared
documents.

### Stage 8 --- Protected Search

Tasks: - Define searchable metadata. - Normalize keywords. - Build
protected search representations. - Restrict results using document
authorization. - Audit searches.

For the MVP, use a controlled HMAC/token-based searchable representation
and document its leakage limitations rather than claiming research-grade
searchable encryption.

**Exit:** Users cannot search documents outside their permissions.

### Stage 9 --- Central Audit Infrastructure

Tasks: - Create one structured audit-event service. - Standardize actor,
action, object, timestamp, result and metadata. - Instrument login,
upload, view, download, search, share, revoke, sign, verification and
integrity events.

**Exit:** Every security-sensitive operation produces a structured
event.

### Stage 10 --- Behavioural Baseline

Tasks: - Aggregate audit events. - Calculate user activity statistics. -
Calculate normal time window. - Persist profiles. - Implement safe
baseline refresh.

**Exit:** Each active user has a usable behavioural profile.

### Stage 11 --- Individual Risk Factors

Implement each factor independently through a common interface:

``` text
evaluate(context) → score + explanation + metadata
```

Implement: 1. Download anomaly. 2. Access-frequency anomaly. 3. Time
anomaly. 4. Document sensitivity. 5. Sharing anomaly. 6. Authentication
anomaly.

**Exit:** Each factor has independent unit tests.

### Stage 12 --- Risk Scoring

Input: - User and role. - Action. - Document and classification. -
Current time. - Recent audit events. - Behavioural baseline. -
Authentication history.

Output: - Score. - Risk level. - Factor scores. - Explanations.

**Exit:** Identical inputs produce deterministic results.

### Stage 13 --- Adaptive Decision Engine

Tasks: - Centralize policy thresholds. - Map risk levels to decisions. -
Integrate with document routes. - Ensure risk can only restrict
RBAC-approved actions.

``` text
RBAC denied → BLOCK
RBAC allowed → Risk Engine
LOW → ALLOW
MEDIUM → ALLOW/MONITOR
HIGH → STEP-UP/RESTRICT
CRITICAL → BLOCK
```

**Exit:** Real document operations enforce risk decisions.

### Stage 14 --- Step-Up Authentication

Tasks: - Temporary challenge. - OTP/TOTP option. - Short challenge
lifetime. - Replay prevention. - Success/failure logging.

**Exit:** High-risk legitimate operations can continue only after
successful additional verification.

### Stage 15 --- Auditor Dashboard

Display: - Recent events. - High/critical risk events. - Risk
distribution. - Risk timeline. - Anomalous users. - Sensitive-document
activity. - Failed logins. - Blocked requests. - Step-up events. -
Integrity failures.

**Exit:** An auditor can inspect why a risk decision occurred.

### Stage 16 --- Security Hardening

Tasks: - Input validation. - File-type and file-size controls. - Rate
limiting. - Secure HTTP headers. - CORS policy. - Secret management. -
Parameterized database access. - Authorization checks. - Safe errors. -
Private-key protection. - Temporary-file cleanup.

**Exit:** Security controls are demonstrated through tests.

### Stage 17 --- Testing

Unit-test crypto, RBAC, expiration, revocation, risk factors, scoring
and policy. Integration-test `Login → RBAC → Risk → Document → Audit`.
Security-test privilege escalation, invalid JWTs, tampered documents,
invalid signatures, mass downloads, unusual-time access and unauthorized
search.

**Exit:** Automated tests cover all critical security paths.

### Stage 18 --- Evaluation and Benchmarking

Measure: - Authentication latency. - AES encryption/decryption time. -
SHA-256 time. - Signature generation/verification. - Key generation. -
Database latency. - Risk evaluation latency. - End-to-end access
latency.

Use several file sizes, e.g. 1 KB, 10 KB, 100 KB, 1 MB and 10 MB,
depending on available hardware.

**Exit:** Results are recorded and can be included in the lab report.

### Stage 19 --- Attack/Scenario Demonstration

Create controlled scenarios:

1.  Normal employee → LOW → ALLOW.
2.  Employee at unusual time → MEDIUM/HIGH.
3.  Mass download → HIGH.
4.  Restricted document → increased sensitivity contribution.
5.  Combined unusual time + mass download + sensitive documents + failed
    logins → CRITICAL → BLOCK.
6.  Admin with normal behaviour → should not automatically receive LOW
    solely because of role.

**Exit:** The adaptive engine demonstrates behaviour-dependent
decisions.

### Stage 20 --- Documentation and Final Integration

Deliver: - Architecture diagram. - Database schema. - API
specification. - Threat model. - Test report. - Cryptographic benchmark
results. - Risk-engine evaluation. - Screenshots/demo flow. - Final
README.

**Exit:** The project can be demonstrated end-to-end and defended
technically.

## 15. Recommended Backend Structure

``` text
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── auth/
│   ├── users/
│   ├── rbac/
│   ├── documents/
│   ├── crypto/
│   │   ├── encryption.py
│   │   ├── hashing.py
│   │   ├── signatures.py
│   │   └── key_manager.py
│   ├── sharing/
│   ├── search/
│   ├── audit/
│   └── risk/
│       ├── router.py
│       ├── schemas.py
│       ├── service.py
│       ├── scorer.py
│       ├── baseline.py
│       ├── factors.py
│       └── policies.py
├── migrations/
└── tests/
```

## 16. API Plan

``` text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

GET/POST /api/users
GET/POST /api/roles

POST /api/documents
GET  /api/documents
GET  /api/documents/{id}
GET  /api/documents/{id}/download
POST /api/documents/{id}/verify
POST /api/documents/{id}/sign
POST /api/documents/{id}/share
POST /api/documents/{id}/revoke

POST /api/search
GET  /api/audit

POST /api/risk/evaluate
GET  /api/risk/events
GET  /api/risk/users/{id}/profile
GET/PUT /api/risk/policy
```

## 17. Example Risk Evaluation

``` json
{
  "risk_score": 78,
  "risk_level": "HIGH",
  "decision": "STEP_UP_AUTH",
  "factors": {
    "download_anomaly": 25,
    "access_frequency_anomaly": 23,
    "time_anomaly": 15,
    "document_sensitivity": 15,
    "sharing_anomaly": 0,
    "authentication_anomaly": 0
  }
}
```

## 18. Example End-to-End Flow

``` text
User requests DOWNLOAD
        ↓
Authenticate JWT
        ↓
Check RBAC
        ↓
Check ownership/share/expiration/revocation
        ↓
Build risk context
        ↓
Calculate risk
        ↓
ALLOW / STEP-UP / RESTRICT / BLOCK
        ↓
If allowed: retrieve encrypted file
        ↓
Verify SHA-256 / signature as applicable
        ↓
Decrypt with protected DEK
        ↓
Deliver document
        ↓
Write audit + risk event
```

## 19. Security Rules

1.  RBAC runs before risk evaluation.
2.  Risk never grants a permission denied by RBAC.
3.  Every protected operation is authorized server-side.
4.  Passwords are never stored in plaintext.
5.  Private keys are never returned through ordinary APIs.
6.  Documents are encrypted before persistent storage.
7.  Expired and revoked access is rejected.
8.  Search respects document authorization.
9.  Security-sensitive operations are audited.
10. Risk decisions are audited.
11. Risk explanations are safe for their intended audience.
12. Baselines do not blindly absorb anomalous events.
13. MVP risk scoring is deterministic.
14. If the risk service fails, sensitive operations follow an explicit
    fail-safe policy rather than silently bypassing risk evaluation.

## 20. Evaluation Metrics

### Security

-   Unauthorized access blocked.
-   Expired/revoked access blocked.
-   Integrity violations detected.
-   Invalid signatures detected.
-   High-risk events detected.

### Risk engine

-   Detection rate.
-   False-positive rate.
-   False-negative rate.
-   Risk calculation latency.
-   Decision consistency.
-   Explanation completeness.

### Cryptography

-   AES encryption/decryption time.
-   SHA-256 computation time.
-   Signature generation/verification time.
-   Key-generation time.

### Auditability

-   Percentage of security-sensitive operations logged.
-   Event metadata completeness.
-   Traceability from document operation to risk decision.

## 21. Future Research Extension --- Machine Learning

Do not begin with ML. First build the deterministic engine and collect
controlled audit data. Then optionally compare the rule-based approach
with Logistic Regression, Random Forest or Isolation Forest.

Compare: - Detection quality. - False positives/negatives. -
Explainability. - Latency. - Adaptability.

The rule-based engine should remain the transparent baseline.

## 22. Final Architecture Principle

> **RBAC determines whether a user is authorized to perform an
> operation, while the Risk Engine evaluates contextual and behavioural
> anomalies to dynamically modify the permitted operation through allow,
> step-up authentication, restriction, or blocking.**

This separation keeps the project academically defensible: the
cryptographic controls provide confidentiality/integrity/authenticity,
RBAC provides baseline authorization, audit logging provides
accountability, and the adaptive risk engine demonstrates contextual
access control on top of those controls.
