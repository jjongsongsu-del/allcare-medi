from fastapi import APIRouter

from app.config import get_settings
from app.schemas import HealthCheck

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthCheck)
def health_check() -> HealthCheck:
    settings = get_settings()
    db_type = "sqlite" if settings.database_url.startswith("sqlite") else "postgresql"
    return HealthCheck(status="ok", db=db_type)
