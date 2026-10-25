from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from app.utils.ApiError import ApiError
from app.auth.router import router as auth_router
from app.rbac.router import router as rbac_router
from app.documents.router import router as document_router
from app.cryptoKeys.router import router as crypto_keys_router
from app.signatures.router import router as signatures_router
from app.risk.router import router as risk_router
from app.audit.router import router as audit_router

app = FastAPI()

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
            "errors": error.errors
        })
    )

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(rbac_router, prefix="/api/rbac", tags=["rbac"])
app.include_router(document_router, prefix="/api/documents", tags=["docs"])
app.include_router(crypto_keys_router, prefix="/api/crypto-keys", tags=["Crypto Keys"])
app.include_router(signatures_router, prefix="/api/signatures", tags=["Signatures"])
app.include_router(risk_router, prefix="/api/risk", tags=["Risk"])
app.include_router(audit_router, prefix="/api/audit", tags=["Audit"])

@app.get("/health")
async def health_check():
    return {"status": "ok", "project": "Securitas"}