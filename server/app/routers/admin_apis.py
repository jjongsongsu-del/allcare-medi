from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.public_api_registry import API_ENDPOINTS, get_api_endpoint
from app.schemas import ApiEndpointRead, ApiTestResult

router = APIRouter(prefix="/admin/apis", tags=["admin-apis"])


@router.get("", response_model=list[ApiEndpointRead])
def list_api_endpoints() -> list[ApiEndpointRead]:
    return [ApiEndpointRead(**endpoint.__dict__) for endpoint in API_ENDPOINTS]


@router.get("/{endpoint_id}/test", response_model=ApiTestResult)
def test_api_endpoint(endpoint_id: str) -> ApiTestResult:
    endpoint = get_api_endpoint(endpoint_id)
    if endpoint is None:
        raise HTTPException(status_code=404, detail="API endpoint not found.")

    settings = get_settings()
    key_configured = bool(settings.public_data_service_key)
    return ApiTestResult(
        id=endpoint.id,
        status="ready" if key_configured and endpoint.enabled else "needs_configuration",
        message="통합 인증키가 설정되어 있습니다." if key_configured else "PUBLIC_DATA_SERVICE_KEY 설정이 필요합니다.",
        sample_url=endpoint.url,
    )
