from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVER_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    app_env: str = "local"
    database_url: str = "sqlite:///./allcaremedi.db"
    public_data_service_key: str = ""
    nmc_api_key: str = ""
    emergency_api_key: str = ""
    e_drug_api_key: str = ""
    health_portal_api_key: str = ""
    ai_inference_url: str = "http://localhost:9000"
    prescription_ocr_provider: str = ""
    prescription_ocr_api_url: str = ""
    prescription_ocr_api_key: str = ""
    prescription_ocr_min_confidence: float = 0.4

    model_config = SettingsConfigDict(env_file=(SERVER_DIR / ".env", ".env"), env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
