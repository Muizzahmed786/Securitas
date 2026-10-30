import logging
import os

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response as StarletteResponse

from app.utils.ApiError import ApiError
from app.auth.router import router as auth_router
from app.rbac.router import router as rbac_router
from app.documents.router import router as document_router
from app.cryptoKeys.router import router as crypto_keys_router
from app.signatures.router import router as signatures_router
from app.risk.router import router as risk_router
from app.audit.router import router as audit_router
from app.search.router import router as search_router

logger = logging.getLogger(__name__)

app = FastAPI(redoc_url=None)

# ---------------------------------------------------------------------------
# CORS — restrict to the configured frontend origin(s).
# Set ALLOWED_ORIGINS in .env to the production frontend URL.
# ---------------------------------------------------------------------------
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
)
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Step-Up-Token"],
    expose_headers=["X-Signing-Key-Id"],
)


# ---------------------------------------------------------------------------
# Security headers on every response
# ---------------------------------------------------------------------------
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: StarletteRequest, call_next
    ) -> StarletteResponse:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault(
            "Referrer-Policy", "strict-origin-when-cross-origin"
        )
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=()",
        )
        return response


app.add_middleware(SecurityHeadersMiddleware)


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------
@app.exception_handler(ApiError)
async def api_error_handler(request: Request, error: ApiError):
    return JSONResponse(
        status_code=error.status_code,
        content=jsonable_encoder({
            "statusCode": error.status_code,
            "data": None,
            "message": error.message,
            "detail": error.message,
            "success": False,
            "errors": error.errors,
        }),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all: never leak a traceback to the client."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "statusCode": 500,
            "data": None,
            "message": "An internal server error occurred.",
            "detail": "An internal server error occurred.",
            "success": False,
            "errors": None,
        },
    )


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(rbac_router, prefix="/api/rbac", tags=["rbac"])
app.include_router(document_router, prefix="/api/documents", tags=["docs"])
app.include_router(crypto_keys_router, prefix="/api/crypto-keys", tags=["Crypto Keys"])
app.include_router(signatures_router, prefix="/api/signatures", tags=["Signatures"])
app.include_router(risk_router, prefix="/api/risk", tags=["Risk"])
app.include_router(audit_router, prefix="/api/audit", tags=["Audit"])
app.include_router(search_router, prefix="/api/search", tags=["Search"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "project": "Securitas"}
