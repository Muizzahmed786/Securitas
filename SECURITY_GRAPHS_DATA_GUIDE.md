# Securitas — Security Graphs Data Generation & Visualization Guide

This guide details all actions required to generate, populate, and visualize data across the **6 Security Graphs** implemented in the Securitas application.

---

## Overview of Implemented Security Graphs

| # | Graph Name | Dashboard Tab | Data Source & API | Description |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Risk Score Over Time** | *Risk Scores & Factors* | `risk_events` table<br>`GET /api/risk/events` | Chronological plot of recorded access-attempt scores with horizontal policy thresholds (Low: 30, Med: 60, High: 80). Points are color-coded by decision (`ALLOW`, `STEP_UP_AUTH`, `BLOCK`). Clickable to inspect factors. |
| **2** | **Six Risk Factors Breakdown** | *Risk Scores & Factors* | `risk_events.factors`<br>`GET /api/risk/events` | Visual radar diagram and linear contribution progress bars showing all 6 behavioral vectors for any selected attempt: raw score (0–100), policy weight (%), weighted contribution (pts), and engine explanation. |
| **3** | **Access Decisions Breakdown** | *Risk Scores & Factors* | `risk_events.decision`<br>`GET /api/risk/events` | Donut chart deriving percentages and counts strictly from supported backend decisions: `ALLOW` (Normal), `STEP_UP_AUTH` (Additional verification), `BLOCK` (Blocked access), and `RESTRICT` (Policy restricted). |
| **4** | **Security Activity Over Time** | *Security Activity Timeline* | `audit_events` table<br>`GET /api/audit/events` | Stacked bar chart grouping audit records by hour or day into `SUCCESS`, `CHALLENGED`, and `DENIED / FAILURE`. Displays browser timezone with UTC database conversion and direct filter links to the Audit ledger. |
| **5** | **Encryption & Decryption Performance** | *Encryption Performance* | Benchmark Engine<br>`GET /api/crypto-keys/benchmark` | Pure CPU cryptographic processing benchmarks across 4 file sizes (64 KB, 512 KB, 2 MB, 8 MB < 20 MiB upload limit), repeated 3 times and averaged. Separates AES-256-GCM from RSA-OAEP 32-byte DEK wrapping and RSA-PSS digest signing. |
| **6** | **Document Sharing Status** | *Document Sharing Status* | `document_access` table<br>`GET /api/documents/shares/summary` | Categorizes document shares into `ACTIVE`, `EXPIRED`, and `REVOKED` states based on verified SQL conditions. Available system-wide to Auditors/Admins and per-tenant to Document Owners. |

---

## Method 1: Automated One-Shot Seeding (Recommended)

To instantly populate all 6 graphs with realistic, verified data across all risk tiers, classifications, and audit actions, run the automated seeder script from the `backend/` directory:

```powershell
# From the project root:
backend\venv\Scripts\python backend/scripts/seed_graph_data.py
```

### What the Automated Script Executes:
1. **Registers & Authenticates 5 Personas**: Admin, Document Owner, Employee (Alice), Employee (Bob), and Security Auditor.
2. **Provisions Keys**: Verifies active RSA-OAEP master wrapping key (KEK) and generates client RSA-PSS signing keys.
3. **Uploads 4 Tiered Documents**: `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, and `RESTRICTED` (AES-256-GCM encrypted).
4. **Creates Document Shares**:
   - 2 Active shares (valid expiration window).
   - 1 Expired share (expiration timestamp in the past).
   - 1 Revoked share (explicitly revoked by owner).
5. **Generates Access Attempts Across All Risk Tiers**:
   - `LOW` Risk (`ALLOW` decision): Normal access to Public/Internal document.
   - `MEDIUM` Risk (`ALLOW / MONITOR` decision): Moderate access to Internal document.
   - `HIGH` Risk (`STEP_UP_AUTH` decision): Access to Confidential/Restricted document triggering OTP challenge.
   - `CRITICAL` Risk (`BLOCK` decision): Severe anomaly trigger with off-hours access and download burst.
6. **Populates Audit Ledger Records**: Logs uploads, downloads, views, searches, sharing grants, revocations, and digital signature verifications across `SUCCESS`, `CHALLENGED`, and `DENIED` statuses.
7. **Executes Hardware Benchmark**: Measures pure CPU latency (ms) and throughput (MB/s) for AES-256-GCM and RSA-OAEP/PSS.

---

## Method 2: Step-by-Step Manual Actions (UI & API)

If you prefer to generate data manually through the Securitas web application or REST API, follow the actions below for each graph:

---

### Graphs 1, 2, & 3: Risk Scores, Six Factors, and Decisions

The behavioral risk engine evaluates access attempts based on user behavior, time, and document classification.

#### Action 1.1: Generate a Low-Risk Attempt (`ALLOW` &le; 30 pts)
1. **Sign in** as an Employee or Document Owner (`/login`).
2. Navigate to **Documents** (`/workspace/sharing`).
3. Click **View** or **Download** on a document with **`PUBLIC`** or **`INTERNAL`** classification during regular business hours (09:00–18:00).
4. **Result**: 
   - `risk_score` will be low (&le; 30.0).
   - `decision` = `ALLOW`.
   - Appears in **Graph 1** as an emerald point, in **Graph 3** under *Allowed (Normal)*, and selectable in **Graph 2**.

#### Action 1.2: Generate a Medium-Risk Attempt (`ALLOW / MONITOR` 31–60 pts)
1. Request access or download of a **`CONFIDENTIAL`** document (sensitivity weight contributes 0.15 &times; 70 = 10.5 pts).
2. Perform 2–3 downloads in rapid succession to trigger a mild access frequency anomaly.
3. **Result**:
   - `risk_score` lands in the 30–60 range.
   - `decision` = `ALLOW` (flagged under active monitoring).
   - Appears in **Graph 1** as a blue point and updates **Graph 3**.

#### Action 1.3: Generate a High-Risk Attempt with Step-Up Challenge (`STEP_UP_AUTH` 61–80 pts)
1. Request access or download of a **`RESTRICTED`** document (sensitivity weight contributes 0.15 &times; 100 = 15.0 pts).
2. Download 4+ documents in an hour to trigger a download volume anomaly.
3. Or request access outside normal operating hours (e.g. late evening or early morning).
4. **Result**:
   - `risk_score` exceeds 60.0.
   - `decision` = `STEP_UP_AUTH`.
   - The UI presents an adaptive 6-digit OTP verification challenge dialog.
   - Appears in **Graph 1** as an amber point and in **Graph 3** under *Step-Up Auth Required*.

#### Action 1.4: Inspecting the Six Factors for Any Selected Attempt (Graph 2)
1. In the **Security Dashboard** on the *Risk Scores & Factors* tab:
   - Click on any point in the **Risk Timeline Chart** (Graph 1), OR
   - Use the **Select Attempt** dropdown in Graph 2.
2. The radar chart and linear contribution bars will instantly display:
   - **Download Anomaly** (25% weight): Compares 24h download count against user baseline.
   - **Access Velocity** (20% weight): Compares 1h request volume against expected hourly baseline.
   - **Time/Hours Anomaly** (15% weight): Evaluates whether requested within the user's standard working window (09:00–18:00) vs. off-hours.
   - **Document Sensitivity** (15% weight): Evaluates classification tier (`PUBLIC`: 0, `INTERNAL`: 30, `CONFIDENTIAL`: 70, `RESTRICTED`: 100).
   - **Sharing Volume** (15% weight): Compares 24h sharing link grants against baseline.
   - **Authentication Failures** (10% weight): Evaluates failed login attempts in the past 24 hours.

---

### Graph 4: Security Activity Over Time

Populated by actions that create rows in `audit_events`.

#### Action 4.1: Generate `SUCCESS` Audit Events
- **Log in** with correct credentials (`auth.login`).
- **Upload** a new document in Document Custody (`documents.upload`).
- **Download / View** an authorized document (`documents.download`, `documents.view`).
- **Grant Share** to a recipient (`documents.share`).
- **Search Content** in Encrypted Content Search (`documents.search`).
- **Sign Document** with a private PEM in Digital Signatures (`documents.sign`).
- **Verify Document Integrity** (`documents.verify`).

#### Action 4.2: Generate `CHALLENGED` Audit Events
- Attempt to download a `RESTRICTED` document or exceed your access velocity threshold to trigger an adaptive step-up OTP challenge.
- The challenge issuance is logged as `status = 'CHALLENGED'`.

#### Action 4.3: Generate `DENIED` / `FAILURE` Audit Events
- **Bad Password**: Attempt to log in with an incorrect password (`auth.login` with `status = 'FAILURE'`).
- **Revoked Document Access**: Attempt to download a document after the owner has revoked your share access grant (`documents.download` with `status = 'DENIED'`).
- **RBAC Denial**: Attempt to call an administrative endpoint without the required role.

#### Action 4.4: Visualizing & Grouping Activity
1. Open the **Security Activity Timeline** tab on the Dashboard or view it on the **Audit** page (`/workspace/advisor/audit`).
2. Use the **By Hour** toggle to inspect activity within the current 24-hour cycle.
3. Use the **By Day** toggle to view multi-day trend patterns.
4. Hover over any bar segment to see the breakdown of Success vs. Challenged vs. Denied operations.
5. In the *Top Audited Operations* section on the Audit page, click any operation chip (e.g. `documents.download`) to immediately filter the ledger table to those specific events.

---

### Graph 5: Encryption & Decryption Performance Benchmark

This graph plots pure CPU processing speed across document sizes within the actual upload limit (20 MiB).

#### Action 5.1: Run a Live Cryptographic Benchmark
1. Navigate to the **Dashboard** as an Auditor, Admin, or Document Owner.
2. Open the **Encryption Performance** tab.
3. Click the **Run Live Benchmark** button in the upper right.
4. **Behind the Scenes**:
   - The backend runs `GET /api/crypto-keys/benchmark`.
   - Pure cryptographic latency (excluding network and disk I/O) is measured across **64 KB**, **512 KB**, **2 MB**, and **8 MB** payloads using Python's `time.perf_counter()`.
   - Each measurement is repeated across 3 iterations and averaged.
5. **Chart Updates**:
   - Bar chart updates with AES-256-GCM encryption latency (ms) and decryption latency (ms), with calculated throughput (MB/s).
   - Asymmetric Enclave Processing cards update with RSA-OAEP 32-byte DEK wrapping/unwrapping times (~0.7–3.5 ms) and RSA-PSS 32-byte digest signing/verification times (~0.6–3.6 ms).
   - Architectural guarantee verifies that RSA never encrypts document bodies.

---

### Graph 6: Document Sharing Status

This graph represents the lifecycle of document access grants.

#### Action 6.1: Create an `ACTIVE` Share Grant
1. Sign in as a **Document Owner** (`/login`).
2. Navigate to **Documents** (`/workspace/sharing`).
3. Locate an uploaded document and click **Share Access**.
4. Enter the recipient's email (e.g. `colleague@company.com`), select permission (`READ` or `DOWNLOAD`), and optionally set a future expiration date.
5. Click **Grant Share**.
6. **Result**: The share is registered with `revoked_at = NULL` and valid `expires_at`. Appears as **Active Grant** (Emerald) in Graph 6.

#### Action 6.2: Create an `EXPIRED` Share Grant
- **Via API / Seeder**: An access grant whose `expires_at` timestamp is earlier than or equal to `CURRENT_TIMESTAMP` automatically transitions to `EXPIRED`.
- **Via UI**: Set a short expiration time (e.g., 5 minutes). Once elapsed, the background evaluation classifies the share as `EXPIRED` (Amber).

#### Action 6.3: Create a `REVOKED` Share Grant
1. In **Documents** (`/workspace/sharing`), click **View Active Grants** on a shared document.
2. Click **Revoke Access** on any existing grant.
3. Confirm revocation.
4. **Result**:
   - Database sets `revoked_at = CURRENT_TIMESTAMP`, `revoked_by = user_id`.
   - The share transitions to **Revoked Grant** (Red) in Graph 6.
   - Any subsequent attempt by that recipient to access the document is blocked with `403 Forbidden` and logged in audit as `DENIED`.

---

## Part 3: Where to View the Graphs in the UI

| Persona / Role | Navigation Path | Available Visualizations |
| :--- | :--- | :--- |
| **Security Auditor**<br>(`SECURITY_AUDITOR`) | **Workspace Dashboard** (`/workspace/dashboard`) | Full **Security Analytics & Behavioral Intelligence** Cockpit:<br>• Tab 1: Risk Scores Over Time (Graph 1), Six Risk Factors (Graph 2), Access Decisions (Graph 3)<br>• Tab 2: Security Activity Timeline (Graph 4)<br>• Tab 3: Encryption & Decryption Performance (Graph 5)<br>• Tab 4: Document Sharing Status (Graph 6) |
| **Security Auditor** | **Audit Ledger** (`/workspace/advisor/audit`) | Interactive **Security Activity Timeline** embedded above the ledger table with clickable top operation filters. |
| **System Administrator**<br>(`ADMIN`) | **Workspace Dashboard** (`/workspace/dashboard`) | Full **Security Analytics Cockpit** covering cryptographic keys, tenant risk posture, and encryption benchmarks. |
| **Document Owner**<br>(`DOCUMENT_OWNER`) | **Workspace Dashboard** (`/workspace/dashboard`) | **Document Sharing Status** breakdown (Active vs. Expired vs. Revoked) and live **Cryptographic Benchmark** monitor. |

---

## Part 4: API Verification Cheatsheet (cURL Examples)

If interacting directly with the backend API:

### 1. Authenticate & Obtain Bearer Token
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -F "username=owner_demo@securitas.local" \
  -F "password=SecurePassword123!"
```

### 2. Query Risk Events (Graphs 1, 2, 3)
```bash
curl -X GET http://localhost:8000/api/risk/events \
  -H "Authorization: Bearer <AUDITOR_TOKEN>"
```

### 3. Query Active Risk Policy Thresholds (Graph 1)
```bash
curl -X GET http://localhost:8000/api/risk/policy \
  -H "Authorization: Bearer <TOKEN>"
```

### 4. Query Audit Activity Logs (Graph 4)
```bash
curl -X GET "http://localhost:8000/api/audit/events?limit=100" \
  -H "Authorization: Bearer <AUDITOR_TOKEN>"
```

### 5. Trigger Cryptographic Performance Benchmark (Graph 5)
```bash
curl -X GET http://localhost:8000/api/crypto-keys/benchmark \
  -H "Authorization: Bearer <TOKEN>"
```

### 6. Query Document Shares Summary (Graph 6)
```bash
curl -X GET http://localhost:8000/api/documents/shares/summary \
  -H "Authorization: Bearer <OWNER_OR_AUDITOR_TOKEN>"
```

---

## Summary Checklist

- [x] Run `python backend/scripts/seed_graph_data.py` to populate all 6 graphs in one command.
- [x] Sign in as **Security Auditor** or **Admin** to view the full Security Analytics Dashboard.
- [x] Test selecting an attempt in **Graph 1** to inspect the 6 distinct factor contributions in **Graph 2**.
- [x] Verify that **Graph 3** reflects decisions (`ALLOW`, `STEP_UP_AUTH`, `BLOCK`).
- [x] Switch between *By Hour* and *By Day* in **Graph 4**.
- [x] Click **Run Live Benchmark** in **Graph 5** to test AES-GCM and RSA-OAEP/PSS performance.
- [x] Check **Graph 6** to see Active, Expired, and Revoked document shares.

