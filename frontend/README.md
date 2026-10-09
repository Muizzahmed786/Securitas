# Securitas frontend

React/TypeScript + Vite + Tailwind. Styled after DBS_Project: blue/white cards,
role-aware sidebar, responsive navigation, document forms and dashboard layouts.

## Run

Use Node.js 22.12+ and start the existing FastAPI backend on port 8000.
From `frontend`:

```bash
npm ci
npm run dev
```

Open the URL Vite prints. `/api` is proxied to `http://127.0.0.1:8000`, allowing
HTTP-only authentication cookies without changing backend CORS configuration.
For local HTTP development, configure the backend's `COOKIE_SECURE=false`.

## Implemented screens

- Landing page, login and registration (email/password plus numeric `role_id`).
- Dashboard with actual permissions and session upload counts.
- PDF/DOC/DOCX encrypted upload, 20 MiB limit and downloadable JSON receipts.
- System RSA wrapping-key creation for `crypto_keys.create` permission holders.
- Signing-key generation/download, public-key listing/download and revocation.
- Local RSA-PSS-SHA256 document signing and signature submission.
- Stored-signature verification by document ID.
- Account details and backend-assigned permissions.

The current backend has no document-list/download, sharing, search, risk or audit
query API. No such routes or fake records are added. Upload receipts are kept in
React memory for the current session only; save a receipt to retain its document
ID after refresh. An existing document ID can be entered in the signature forms.

Frontend files and the frontend CI workflow are the only changes in this update.
Backend authorization remains authoritative. Registration exposes Document Owner
and Employee; it does not offer self-registration as Admin or Auditor.

## Signing

The server generates a private-key PEM and returns it once as a download; the
public key is registered server-side. With an empty optional passphrase, the PEM
is unencrypted PKCS8 and can be imported locally by Web Crypto. Protect this file
on your machine. With a passphrase, the downloaded PEM is encrypted; use a local
compatible signing tool and paste its Base64 signature into the existing-signature
form. Private-key files and original document files selected for browser signing
are never uploaded by that form. Only `signing_key_id` and `signature_base64` are
sent. The server verifies against the stored original before recording a signature.

The signing algorithm is RSA-PSS with SHA-256, MGF1 SHA-256 and a 32-byte salt.
Signing runs on HTTPS or localhost using `crypto.subtle`. Downloads should be
allowed in the browser. The wrapping key is separate from a user's signing key.

Key generation, upload and signature submission are not retried automatically.
Read requests can refresh an expired access token once; a preflight identity check
refreshes before a mutation. Failure messages from the API are surfaced to users.

## Checks

```bash
npm run build
npm run lint
npm install --no-save @playwright/test
npx playwright install chromium
npx playwright test
```

Playwright browser tests mock the current backend response contracts, exercise
login, role payloads, multipart upload, receipt downloads, one-time key downloads,
permission gates and mobile navigation. They also validate browser-created
RSA-PSS signatures with an independent Node crypto verification. They do not
replace end-to-end testing against a configured real backend/database.

## Backend setup prerequisites

The existing backend requires PostgreSQL, seeded roles/permissions, its environment
variables, and valid wrapping-key storage/passphrases. The current schema assigns
roles 1=ADMIN, 2=DOCUMENT_OWNER, 3=EMPLOYEE, 4=SECURITY_AUDITOR. The frontend sends
the role IDs required by the existing registration API.

The current wrapping-key creation route reads `RSA_PRIVATE_KEY_PASSPHRASE`, while
signature document decryption reads `WRAPPING_PRIVATE_KEY_PASSPHRASE`. Configure
both to the same secret when using the same encrypted wrapping private key.
Backend imports require bcrypt, python-dotenv, pycryptodomex and olefile in addition
to its currently listed requirements. Those backend files are not changed here.
