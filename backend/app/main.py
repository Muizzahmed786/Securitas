from fastapi import FastAPI
from app.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

from app.auth.router import router as auth_router

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

@app.get("/health")
async def health_check():
    return {"status": "ok", "project": settings.PROJECT_NAME}
