from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List, Union
import json


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "TimeTracker"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str
    DATABASE_URL_SYNC: str = ""

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    REFRESH_TOKEN_EXPIRE_DAYS: int = 365

    # Hermes service access: a static API key that lets a trusted agent (hermes)
    # call the API without the JWT login/refresh flow. Requests carrying a valid
    # `X-API-Key` header act as HERMES_USER_EMAIL. Leave HERMES_API_KEY empty to
    # disable this bypass entirely.
    HERMES_API_KEY: str = ""
    HERMES_USER_EMAIL: str = ""

    # CORS - use str to avoid pydantic auto-parsing, then convert in validator
    CORS_ORIGINS: Union[List[str], str] = '["http://localhost:3000"]'

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            if not v or v.strip() == "":
                return ["http://localhost:3000"]
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
                return [parsed]
            except json.JSONDecodeError:
                return [i.strip() for i in v.split(",") if i.strip()]
        return ["http://localhost:3000"]


settings = Settings()
