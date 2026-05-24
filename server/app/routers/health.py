from fastapi import APIRouter

from app.config import get_settings
from app.schemas import AppStartupRead, HealthCheck

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthCheck)
def health_check() -> HealthCheck:
    settings = get_settings()
    db_type = "sqlite" if settings.database_url.startswith("sqlite") else "postgresql"
    return HealthCheck(status="ok", db=db_type)


@router.get("/app-startup", response_model=AppStartupRead)
def app_startup() -> AppStartupRead:
    settings = get_settings()
    return AppStartupRead(
        status="ok",
        minVersion=settings.app_min_version,
        latestVersion=settings.app_latest_version,
        androidStoreUrl=settings.app_android_store_url,
        iosStoreUrl=settings.app_ios_store_url or None,
        supportContactUrl=settings.support_contact_url,
        message="올케어메디 서비스를 정상적으로 이용할 수 있습니다.",
    )
