from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from app.auth.router import router as auth_router
from app.utils.ApiError import ApiError

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

@app.get("/health")
async def health_check():
    return {"status": "ok", "project": "Securitas"}