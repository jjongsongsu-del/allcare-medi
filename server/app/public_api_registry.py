from dataclasses import dataclass


@dataclass(frozen=True)
class ApiEndpoint:
    id: str
    provider: str
    name: str
    category: str
    method: str
    url: str
    operation: str
    auth_type: str
    enabled: bool
    doc_file: str
    description: str


API_ENDPOINTS = [
    ApiEndpoint(
        id="nmc-pharmacy-location",
        provider="국립중앙의료원",
        name="전국약국정보조회 위치기반 조회",
        category="pharmacy",
        method="GET",
        url="http://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyLcinfoInqire",
        operation="getParmacyLcinfoInqire",
        auth_type="serviceKey",
        enabled=True,
        doc_file="NIA-IFT-OpenAPI활용가이드-01.국립중앙의료원_전국약국정보조회서비스.pdf",
        description="WGS84 좌표 기준 가까운 약국 목록을 조회합니다."
    ),
    ApiEndpoint(
        id="nmc-pharmacy-list",
        provider="국립중앙의료원",
        name="전국약국정보조회 지역 목록",
        category="pharmacy",
        method="GET",
        url="http://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyListInfoInqire",
        operation="getParmacyListInfoInqire",
        auth_type="serviceKey",
        enabled=True,
        doc_file="NIA-IFT-OpenAPI활용가이드-01.국립중앙의료원_전국약국정보조회서비스.pdf",
        description="시도/시군구 조건으로 약국 목록을 조회합니다."
    ),
    ApiEndpoint(
        id="nmc-hospital-location",
        provider="국립중앙의료원",
        name="병의원찾기 위치기반 조회",
        category="hospital",
        method="GET",
        url="http://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlMdcncLcinfoInqire",
        operation="getHsptlMdcncLcinfoInqire",
        auth_type="serviceKey",
        enabled=True,
        doc_file="NIA-IFT-OpenAPI활용가이드-01.국립중앙의료원-병의원찾기서비스.pdf",
        description="WGS84 좌표 기준 가까운 병·의원 목록을 조회합니다."
    ),
    ApiEndpoint(
        id="nmc-hospital-list",
        provider="국립중앙의료원",
        name="병의원찾기 지역 목록",
        category="hospital",
        method="GET",
        url="http://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlMdcncListInfoInqire",
        operation="getHsptlMdcncListInfoInqire",
        auth_type="serviceKey",
        enabled=True,
        doc_file="NIA-IFT-OpenAPI활용가이드-01.국립중앙의료원-병의원찾기서비스.pdf",
        description="시도/시군구/진료과 조건으로 병·의원 목록을 조회합니다."
    ),
    ApiEndpoint(
        id="nmc-emergency-location",
        provider="국립중앙의료원",
        name="응급의료기관 위치기반 조회",
        category="emergency",
        method="GET",
        url="http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEgytLcinfoInqire",
        operation="getEgytLcinfoInqire",
        auth_type="serviceKey",
        enabled=True,
        doc_file="NIA-IFT-OpenAPI활용가이드-01.국립중앙의료원-응급의료정보조회서비스_V4.pdf",
        description="WGS84 좌표 기준 가까운 응급의료기관을 조회합니다."
    ),
    ApiEndpoint(
        id="kdca-health-info",
        provider="질병관리청",
        name="국가건강정보포털 건강정보 상세",
        category="health-content",
        method="GET",
        url="http://api.kdca.go.kr/api/provide/healthInfo",
        operation="view",
        auth_type="TOKEN",
        enabled=False,
        doc_file="국가건강정보포털(건강정보 관련)정보.pdf",
        description="건강정보 콘텐츠 상세를 조회합니다. 별도 TOKEN 체계입니다."
    ),
    ApiEndpoint(
        id="mfds-dur-product-info",
        provider="식품의약품안전처",
        name="의약품안전사용서비스(DUR) 품목정보",
        category="medication-safety",
        method="GET",
        url="https://apis.data.go.kr/1471000/DURPrdlstInfoService03/getDurPrdlstInfoList03",
        operation="getDurPrdlstInfoList03",
        auth_type="serviceKey",
        enabled=True,
        doc_file="식품의약품안전처_의약품안전사용서비스(DUR)품목정보.png",
        description="약명 기준으로 DUR 품목 유형, 용량주의, 연령금기, 임부금기 등 안전사용 주의 정보를 조회합니다."
    ),
]


def get_api_endpoint(endpoint_id: str) -> ApiEndpoint | None:
    return next((endpoint for endpoint in API_ENDPOINTS if endpoint.id == endpoint_id), None)
