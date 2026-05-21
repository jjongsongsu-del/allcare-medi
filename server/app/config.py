from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "local"
    database_url: str = "sqlite:///./allcaremedi.db"
    nmc_api_key: str = ""
    emergency_api_key: str = ""
    e_drug_api_key: str = ""
    health_portal_api_key: str = ""
    ai_inference_url: str = "http://localhost:9000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
