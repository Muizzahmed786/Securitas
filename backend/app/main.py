from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from app.utils.ApiError import ApiError
from app.auth.router import router as auth_router
from app.rbac.router import router as rbac_router
from app.documents.router import router as document_router
from app.cryptoKeys.router import router as crypto_keys_router

app = FastAPI()

@app.exception_handler(ApiError)
async def api_error_handler(request: Request, error: ApiError):
    return JSONResponse(
        status_code=error.status_code,
        content=jsonable_encoder({
            "statusCode": error.status_code,
            "data": None,
            "message": error.message,
            "success": False,
            "errors": error.errors
        })
    )

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(rbac_router, prefix="/api/rbac", tags=["rbac"])
app.include_router(document_router,prefix="/api/documents",tags=["docs"])
app.include_router(crypto_keys_router,prefix="/api/crypto-keys",tags=["Crypto Keys"],)


@app.get("/health")
async def health_check():
    return {"status": "ok", "project": "Securitas"}