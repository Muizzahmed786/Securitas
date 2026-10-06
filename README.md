# Securitas (DocSentinel)

**An Adaptive Risk-Based Secure Document Management and Access Control System**

Securitas is a secure document-management platform combining authentication, Role-Based Access Control (RBAC), AES document encryption, asymmetric key protection, SHA-256 integrity verification, digital signatures, controlled sharing, expiration/revocation, protected search, audit logging, and an adaptive risk engine.

## 🌟 Key Features

- **Identity & Authorization:** JWT-based Authentication and Role-Based Access Control (RBAC).
- **Document Security:** AES-GCM document encryption at rest, RSA/ECC-based key protection, SHA-256 integrity hashes, and Digital Signatures.
- **Controlled Sharing:** User-to-user sharing with read/download permissions, expiration, and revocation.
- **Adaptive Risk Engine:** Calculates contextual risk scores (LOW/MEDIUM/HIGH/CRITICAL) based on user behavior baselines (download anomalies, time anomalies, etc.) to dynamically ALLOW, STEP-UP, RESTRICT, or BLOCK operations.
- **Audit & Compliance:** Comprehensive security audit logging and an Auditor Dashboard explaining security decisions.
- **Protected Search:** Authorized protected document search capabilities.

## 🏗 Architecture

The system operates on a core architectural rule:
`Authentication → RBAC → Context Builder → Risk Engine → Decision → Document Operation → Audit`

RBAC remains the first authorization boundary. The Risk Engine can further restrict an RBAC-approved operation, but it must never grant access that RBAC denied.

## 💻 Tech Stack

**Frontend:**
- React.js (Vite)
- Tailwind CSS
- Zustand (State Management)
- Recharts
- Lucide React

**Backend:**
- Python (FastAPI)
- SQLAlchemy (PostgreSQL)
- Pydantic v2 & Alembic
- Cryptography (AES, RSA/ECC, SHA-256)
- JWT & Argon2

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL (pgAdmin recommended for Windows users)

### Database Setup
1. Install PostgreSQL on your machine if you haven't already.
2. Open **pgAdmin** or your preferred database client (or use `psql` in the terminal).
3. Connect to your local PostgreSQL server (default user is usually `postgres`).
4. Create a new database for the project (e.g., `securitas`):
   ```sql
   CREATE DATABASE securitas;
   ```
5. Note down your PostgreSQL password for the `postgres` user, as you will need it for the `.env` configuration step below.

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/Scripts/activate  # On Windows use `venv\Scripts\activate`
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up your `.env` file (refer to `.env.example`).
5. Run database migrations:
   ```bash
   alembic upgrade head
   ```
6. Start the server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 🛡 Security Rules

1. RBAC runs before risk evaluation.
2. Risk never grants a permission denied by RBAC.
3. Every protected operation is authorized server-side.
4. Passwords are never stored in plaintext.
5. Private keys are never returned through ordinary APIs.
6. Documents are encrypted before persistent storage.