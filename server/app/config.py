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
    kdca_health_info_token: str = "19e3ef9cbff3"
    kdca_health_info_base_url: str = "http://api.kdca.go.kr/api/provide/healthInfo"
    ai_inference_url: str = "http://localhost:9000"
    prescription_ocr_provider: str = ""
    prescription_ocr_api_url: str = ""
    prescription_ocr_api_key: str = ""
    prescription_ocr_min_confidence: float = 0.4
    app_min_version: str = "0.1.0"
    app_latest_version: str = "0.1.0"
    app_android_store_url: str = "market://details?id=kr.allcaremedi.app"
    app_ios_store_url: str = ""
    support_contact_url: str = "mailto:support@allcaremedi.local"
    google_android_client_id: str = ""
    google_web_client_id: str = ""
    kakao_native_app_key: str = ""
    kakao_rest_api_key: str = ""
    kakao_client_secret: str = ""
    naver_client_id: str = ""
    naver_client_secret: str = ""

    model_config = SettingsConfigDict(env_file=(SERVER_DIR / ".env", ".env"), env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
