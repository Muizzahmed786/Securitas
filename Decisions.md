# Securitas Architectural Decision Records (`Decisions.md`)

This document is the **decision log and architectural memory of Securitas**.

It records important decisions made during development so that a developer encountering the project for the first time can immediately understand what was decided, why, what alternatives were considered, and the consequences of the decision.

---

## ADR-001 — Project Name

**Status:** Accepted

**Date:** 2026-10-05

**Area:** Architecture

### Context

The project needed a definitive name to establish the namespace, repository, and terminology for documentation and code. Although early documents referenced 'DocSentinel', a final decision on the brand and namespace was required.

### Decision

Name the project **Securitas**.

### Why

The name represents security, trust, and safeguarding, which aligns perfectly with the core goal of the secure document protection system. It establishes a clear, professional identity for the codebase.

### Alternatives Considered

| Alternative | Evaluation | Result |
|---|---|---|
| DocSentinel | Was the working title in the original PRD. | Rejected in favor of Securitas as requested by project steering. |

### Consequences

#### Positive

- Clear, unified branding across the codebase.
- Consistent namespace for imports and modules.

#### Negative / Trade-offs

- Requires updating some original design documents (like the PRD) to reflect the final name.

### Security Impact

None.

### Implementation Impact

Global namespace, repository name, and documentation references.

### Related Decisions

- None

### Current State

Accepted and applied to all root documentation.

---

## ADR-002 — Primary Database

**Status:** Accepted

**Date:** 2026-10-05

**Area:** Database

### Context

The system requires a persistent store for structured entities to manage access control, metadata, and audit logs.

### Decision

Use **PostgreSQL** as the primary database.

### Why

Securitas contains strongly related entities such as users, roles, permissions, documents, access grants, audit events, and risk events. These require referential integrity, ACID transactions, and relational queries for behavioural analysis (baseline calculation). 

### Alternatives Considered

| Alternative | Evaluation | Result |
|---|---|---|
| MongoDB | Document-oriented NoSQL database. | Rejected. Using MongoDB would not provide a meaningful advantage for the current relational security model and would introduce unnecessary architectural complexity if PostgreSQL were also required for relational mapping. |

### Consequences

#### Positive

- Strong data consistency.
- Native support for complex joins required by the Risk Engine to build user baselines.

#### Negative / Trade-offs

- Schema migrations require careful management (e.g., using Alembic).

### Security Impact

Ensures strict referential integrity for access controls (e.g., a document cannot be shared with a non-existent user), strengthening the authorization layer.

### Implementation Impact

Requires SQLAlchemy, Alembic, and PostgreSQL drivers (`psycopg2` or `asyncpg`).

### Related Decisions

- `ADR-003`

### Current State

Accepted for the MVP architecture.

---

## ADR-003 — Encrypted File Storage Separation

**Status:** Accepted

**Date:** 2026-10-05

**Area:** Architecture / Database

### Context

Documents uploaded to Securitas will be encrypted and stored. We need to decide whether to store the ciphertext binary blobs in the relational database or on a dedicated file/object storage system.

### Decision

PostgreSQL stores metadata. Encrypted document contents are stored separately in **file/object storage** (local file system abstraction for MVP, extensible to S3).

### Why

Relational databases are inefficient at storing and streaming large binary files (BLOBs). Storing encrypted documents in the database would lead to rapid database bloat, slow down backups, and degrade query performance for metadata and audit events. 

### Alternatives Considered

| Alternative | Evaluation | Result |
|---|---|---|
| PostgreSQL `bytea` | Store ciphertext directly in a database column. | Rejected due to performance degradation and backup bloat. |

### Consequences

#### Positive

- Fast, efficient database queries.
- Easy to scale storage independently from the database compute.

#### Negative / Trade-offs

- Requires a mechanism to ensure consistency between the database metadata (document record) and the physical file (if a transaction rolls back, the file must be cleaned up).

### Security Impact

File permissions on the object storage must be strictly configured so that only the backend service can access the encrypted blobs. The database does not contain the files, reducing the impact of a SQL injection attack attempting to exfiltrate bulk documents.

### Implementation Impact

Requires a storage abstraction layer in `backend/app/documents/storage.py`.

### Related Decisions

- `ADR-002`

### Current State

Accepted.

---

## ADR-004 — RBAC Before Risk

**Status:** Accepted

**Date:** 2026-10-05

**Area:** Security / Authorization

### Context

The system implements both static Role-Based Access Control (RBAC) and a dynamic Risk Engine. The order and authority of these two authorization mechanisms needed definition.

### Decision

**RBAC is the primary authorization boundary.** The Risk Engine can restrict an already-authorized operation but cannot turn an RBAC-denied request into an allowed request.

### Why

RBAC defines the absolute, legal baseline of what a user is permitted to do. The Risk Engine is a defense-in-depth measure designed to detect compromised accounts or insider threats. Allowing the Risk Engine to override an RBAC denial would violate the Principle of Least Privilege and create unpredictable security loopholes.

### Alternatives Considered

| Alternative | Evaluation | Result |
|---|---|---|
| Risk overrides RBAC | Let a 'LOW' risk score grant access even if RBAC denies it. | Rejected. Introduces unacceptable security vulnerabilities. |
| Parallel Evaluation | Run both, require both to pass. | Rejected for performance; no need to calculate risk if RBAC denies upfront. |

### Consequences

#### Positive

- Predictable baseline security.
- Performance optimization (Risk Engine is bypassed if RBAC denies).

#### Negative / Trade-offs

- None.

### Security Impact

Enforces strict boundaries. A compromised Risk Engine cannot grant unauthorized access to sensitive documents.

### Implementation Impact

Authorization middleware/dependencies must sequentially execute RBAC checks, and only on success invoke the Risk Context Builder.

### Related Decisions

- `ADR-005`

### Current State

Accepted.

---

## ADR-005 — Rule-Based Risk Engine for MVP

**Status:** Accepted

**Date:** 2026-10-05

**Area:** Risk

### Context

The Adaptive Risk Engine requires a mechanism to calculate a risk score based on behavioral anomalies. This could be implemented using deterministic rules or machine learning.

### Decision

Use a **deterministic rule-based Risk Engine** with weighted scoring for the MVP.

### Why

The project needs an explainable and deterministic baseline first. The available behavioural dataset is initially limited, and the security team needs to understand *exactly* why a request received a particular risk score. 

### Alternatives Considered

| Alternative | Evaluation | Result |
|---|---|---|
| Machine-Learning UEBA | Deep-learning or Isolation Forests for anomaly detection. | Rejected initially. Too opaque (black box), requires extensive training data, and harder to debug during initial development. |

### Consequences

#### Positive

- High explainability for auditors.
- Deterministic and easy to write unit tests against.

#### Negative / Trade-offs

- Manual tuning of weights and thresholds is required.
- May miss subtle, non-linear anomalies that ML would catch.

### Security Impact

Ensures decisions are fully auditable and predictable, satisfying transparency requirements for the security auditor role.

### Implementation Impact

Implementation in `backend/app/risk/scorer.py` will use simple mathematical weighting rather than loading a model.

### Related Decisions

- `ADR-006`
- `ADR-007`

### Current State

Accepted for MVP. ML may be evaluated later against this rule-based baseline.

---

## ADR-006 — Risk Factors

**Status:** Accepted

**Date:** 2026-10-05

**Area:** Risk

### Context

To calculate a risk score, the rule-based Risk Engine requires specific inputs (signals) to evaluate against the user's behavioural baseline.

### Decision

Evaluate the following 6 factors with defined weights:
1. Download anomaly (25%)
2. Access-frequency anomaly (20%)
3. Time anomaly (15%)
4. Document sensitivity (15%)
5. Sharing anomaly (15%)
6. Authentication anomaly (10%)

### Why

These factors capture the most common vectors of insider threats and compromised accounts (e.g., mass downloading, accessing sensitive files at 3 AM, sudden spikes in sharing). The weights prioritize data exfiltration (downloads) over passive access.

### Alternatives Considered

| Alternative | Evaluation | Result |
|---|---|---|
| Network traffic inspection | Monitor packet sizes. | Rejected. Out of scope for application layer. |
| Geolocation intelligence | Evaluate IP location jumps. | Rejected. Out of scope for MVP, requires external IP-to-Geo databases. |

### Consequences

#### Positive

- Comprehensive coverage of application-layer behavioral threats.

#### Negative / Trade-offs

- Requires robust audit logging to calculate baselines accurately.

### Security Impact

Directly determines the system's ability to detect anomalous behavior.

### Implementation Impact

Requires tracking average daily downloads, access times, and failed logins in the `user_behavior_profile` table.

### Related Decisions

- `ADR-005`

### Current State

Accepted.

---

## ADR-007 — Risk Thresholds

**Status:** Accepted

**Date:** 2026-10-05

**Area:** Risk

### Context

The Risk Engine outputs a score between 0 and 100. This score must be mapped to discrete levels (LOW, MEDIUM, HIGH, CRITICAL) to drive policy decisions.

### Decision

Define the levels as:
- **LOW**: 0-30 → ALLOW
- **MEDIUM**: 31-60 → ALLOW / MONITOR
- **HIGH**: 61-80 → STEP-UP AUTH / RESTRICT
- **CRITICAL**: 81-100 → BLOCK

These thresholds **must be configurable** dynamically or via environment variables.

### Why

Hardcoded thresholds force code deployments to tune the security posture. Different environments (or threat landscapes) require the ability to adjust sensitivity on the fly. 

### Alternatives Considered

| Alternative | Evaluation | Result |
|---|---|---|
| Hardcoded constants | Define thresholds directly in `policies.py`. | Rejected. Reduces operational flexibility. |

### Consequences

#### Positive

- Administrators can tighten security during an active threat without deploying code.

#### Negative / Trade-offs

- Requires a configuration service or database table to store the active thresholds.

### Security Impact

Allows rapid response to changing threat models (e.g., lowering the CRITICAL threshold to 70 during an incident).

### Implementation Impact

Risk policies must read from a configuration source rather than static constants.

### Related Decisions

- `ADR-005`

### Current State

Accepted.

---

## ADR-008 — Role Does Not Automatically Reduce Risk

**Status:** Accepted

**Date:** 2026-10-05

**Area:** Risk / Security

### Context

Administrators have broad access privileges. Should the Risk Engine apply a "discount" to their risk scores to prevent operational friction?

### Decision

An Admin (or any role) **should not receive a low risk score merely because of their role**. Role influences the *expected behaviour/context* (e.g., their baseline for access frequency might naturally be higher), but it does not bypass anomaly detection.

### Why

Administrators are high-value targets. A compromised Admin account poses the highest possible risk to the system. Bypassing anomaly detection for privileged users creates a massive blind spot for attackers to exploit. 

### Alternatives Considered

| Alternative | Evaluation | Result |
|---|---|---|
| Admin Whitelist | Automatically set risk to LOW for Admins. | Rejected. Extremely dangerous security posture. |

### Consequences

#### Positive

- Protects the system against compromised privileged accounts.

#### Negative / Trade-offs

- Admins doing unusual maintenance tasks at 3 AM might trigger a STEP-UP authentication or BLOCK. 

### Security Impact

Significantly enhances defense against privileged account takeover.

### Implementation Impact

The Risk Engine must treat roles as contextual input for baseline calculation, not as an override switch in the policy engine.

### Related Decisions

- None.

### Current State

Accepted.

---

## ADR-009 — Do Not Automatically Permanently Revoke Accounts

**Status:** Accepted

**Date:** 2026-10-05

**Area:** Security / User Lifecycle

### Context

When the Risk Engine detects a CRITICAL risk score, the system must take action to protect the data. The ultimate action is permanent account termination.

### Decision

For the MVP, high-risk activity should produce controls such as **STEP-UP, RESTRICT, BLOCK, and AUDIT** rather than immediately deleting or permanently deactivating accounts.

### Why

False positives are inevitable in any anomaly detection system. Autonomous permanent deletion causes unrecoverable data loss, operational disruption, and can be weaponized by an attacker to cause a Denial of Service (DoS) against legitimate users. 

### Alternatives Considered

| Alternative | Evaluation | Result |
|---|---|---|
| Autonomous Account Termination | Delete the user on CRITICAL score. | Rejected. Recovery implications are too severe. |

### Consequences

#### Positive

- Safe recovery from false positives.
- Prevents weaponized DoS attacks.

#### Negative / Trade-offs

- Requires human intervention (Security Auditor/Admin) to review blocked accounts and manually resolve the risk event.

### Security Impact

Balances confidentiality protection (blocking access) with availability (not permanently destroying the account).

### Implementation Impact

Requires state management for active blocks, but avoids cascading deletes in the database.

### Related Decisions

- `ADR-007`

### Current State

Accepted.
