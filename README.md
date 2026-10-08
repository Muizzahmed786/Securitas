# Securitas

Progress-check milestone: authenticated encrypted document upload, owner-only
listing/download, and a working React interface. The backend uses AES-256-GCM
with a new document key and nonce per upload, and RSA-OAEP-SHA256 to wrap that key.
RSA private keys are password-encrypted PEM files outside PostgreSQL.

Implemented: registration/login/logout with revocable server-side sessions,
RBAC, upload validation (TXT/PDF/DOC/DOCX, 20 MiB), encrypted storage, private
listing, original-file download, and successful upload/download audit records.

Deferred: sharing, search, digital signatures, standalone SHA-256 verification,
tampering demonstration, audit dashboard, and adaptive risk engine. AES-GCM's
mandatory authentication-tag validation remains part of decryption. The existing
`content_hash` column is populated for schema compatibility, with no verification
endpoint or tamper UI in this milestone.

## Local setup

Use Python 3.10+, PostgreSQL 14+, and Node.js 22.12+ (the existing Vite 8 frontend).
Keep PostgreSQL running before starting the API.

1. Create an empty database called `securitas` using pgAdmin or psql.
2. Copy the root `.env.example` to `backend/.env`.
3. Set your PostgreSQL credentials in `DATABASE_URL`. Keep the
   `postgresql+asyncpg://` prefix. URL-encode special characters in credentials.
4. Generate three DIFFERENT random secrets for `ACCESS_TOKEN_SECRET`,
   `REFRESH_TOKEN_SECRET`, and `RSA_PRIVATE_KEY_PASSPHRASE`. One generation command:

   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

   Run it three times. Replace the placeholders. Do not commit `.env`, private
   keys, or uploaded files. Back up private keys AND their passphrase; losing
   either prevents recovery of stored documents.

### Backend

From the repository root:

```bash
cd backend
python -m venv .venv
```

Activate the environment:

```bash
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS/Linux
source .venv/bin/activate
```

Install and initialize:

```bash
python -m pip install -r requirements.txt
python manage.py init-db
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

`init-db` executes the root schema once against an empty database. For an
existing database that already has the complete root schema, use
`python manage.py sync-permissions` instead. Do not rerun the full schema over
existing tables. The legacy empty Alembic revision is NOT the setup command for
this milestone; migrating the full schema into versioned Alembic revisions is
future work.

### Frontend

In another terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open the URL Vite prints, normally `http://localhost:5173`. Vite proxies `/api`
to the backend, so browser sessions work without cross-origin configuration.
Use the same hostname consistently. Backend API docs are available at
`http://127.0.0.1:8000/docs`.

### Initialize encryption once

1. Register your setup account through the UI. Public registration always assigns
   `DOCUMENT_OWNER`; it cannot create an Admin.
2. In another activated backend terminal, promote that account locally:

   ```bash
   python manage.py promote-admin your-email@example.com
   ```

3. Sign out and sign back in. Click **Initialize encryption** once. This creates
   the system RSA wrapping key. A second attempt returns "already exists".
4. Register normal document-owner accounts for the demonstration.

The RSA passphrase must be set before initializing encryption. The default
storage directories are `backend/private_keys` and `backend/private_uploads`.
They are not served as public/static directories. File permissions are restricted
on POSIX systems; on Windows, restrict the folders to the account running the API.

## Progress-check demonstration

1. Sign in as account A and upload a UTF-8 TXT, PDF, DOC or DOCX file.
2. Show its opaque UUID-named `.enc` file under `backend/private_uploads`.
   The original contents are not stored there as plaintext.
3. Download through the UI and open the restored original.
4. Sign out and sign in as account B. Account A's files do not appear.
5. Request A's download URL while signed in as B: the API returns 404 without
   disclosing the file. You can use the network tab or a cookie-aware API client.
6. Show the `audit_events` rows for the successful upload/download.

For `/docs` uploads, sign in via `POST /api/auth/login` using JSON first; the
HTTP-only session cookies authenticate subsequent calls from that browser.

## Verification

From `backend`:

```bash
python -m unittest discover -s tests -v
```

The crypto tests run without a database and check exact byte round trips,
unique keys/nonces, encrypted private keys and the maximum file size.

For the API integration tests, create a disposable PostgreSQL database, then
set `TEST_DATABASE_URL` before running the same command:

```powershell
# Windows PowerShell; replace the credentials
$env:TEST_DATABASE_URL="postgresql+asyncpg://postgres:YOUR_PASSWORD@127.0.0.1:5432/securitas_test"
python -m unittest discover -s tests -v
```

```bash
# macOS/Linux; replace the credentials
TEST_DATABASE_URL='postgresql+asyncpg://postgres:YOUR_PASSWORD@127.0.0.1:5432/securitas_test' python -m unittest discover -s tests -v
```

Each integration test creates and drops a random schema. Tests cover the actual
upload/list/download API, owner isolation, anonymous denial, validation, refresh,
registration role restrictions and logout revocation. Without `TEST_DATABASE_URL`,
these tests are explicitly skipped.

From `frontend`, run `npm run build` and `npm run lint`.

## Architecture boundaries

Role permissions authorize actions; ownership limits those actions to a user's
own files. Even Admin downloads are owner-scoped in this milestone. All key
unwrapping and file decryption happens on the trusted server after authorization.
There is no sharing or recipient-side decryption yet. Logout revokes the session
used by both access and refresh tokens. Tokens from the previous implementation
lack session claims and require a fresh login after this update.

This local progress-check app has no production deployment configuration. An
internet deployment also needs HTTPS, secure cookies, rate limiting, CSRF/origin
controls, a least-privilege runtime database user, and managed secret storage.
