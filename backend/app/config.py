from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Securitas"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/securitas"
    SECRET_KEY: str = "super-secret-key-change-me"
    
    class Config:
        env_file = ".env"

settings = Settings()
