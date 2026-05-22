from pydantic import BaseModel, Field


class HealthCheck(BaseModel):
    status: str
    db: str


class MedicationCreate(BaseModel):
    user_id: int = Field(..., ge=1)
    product_name: str = Field(..., min_length=1, max_length=160)
    ingredient: str = Field(..., min_length=1, max_length=200)
    manufacturer: str | None = Field(default=None, max_length=120)
    source: str = Field(default="manual", max_length=40)
    safety_note: str | None = None


class MedicationRead(BaseModel):
    id: int
    user_id: int
    product_name: str
    ingredient: str
    manufacturer: str | None
    source: str
    safety_note: str | None

    model_config = {"from_attributes": True}


class FacilityReportCreate(BaseModel):
    facility_external_id: str = Field(..., min_length=1, max_length=80)
    facility_name: str = Field(..., min_length=1, max_length=160)
    report_type: str = Field(..., min_length=1, max_length=40)
    description: str | None = None
    reporter_contact: str | None = Field(default=None, max_length=120)


class FacilityReportRead(BaseModel):
    id: int
    facility_external_id: str
    facility_name: str
    report_type: str
    description: str | None
    reporter_contact: str | None
    status: str

    model_config = {"from_attributes": True}


class ApiEndpointRead(BaseModel):
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


class ApiTestResult(BaseModel):
    id: str
    status: str
    message: str
    sample_url: str


class FacilitySearchParams(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    query: str | None = None
    type: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=10, ge=1, le=50)


class FacilitySearchResult(BaseModel):
    id: str
    name: str
    type: str
    department: str | None = None
    distance_km: float | None = None
    operating_status: str
    hours: str
    phone: str
    address: str
    latitude: float | None = None
    longitude: float | None = None
    last_updated: str | None = None
    tags: list[str] = []


class FacilitySearchResponse(BaseModel):
    source: str
    results: list[FacilitySearchResult]
    message: str | None = None


class SocialLoginRequest(BaseModel):
    provider: str = Field(..., pattern="^(GOOGLE|KAKAO|NAVER)$")
    idToken: str = Field(..., min_length=8)
    deviceUuid: str = Field(..., min_length=8, max_length=255)
    pushToken: str | None = None
    deviceName: str | None = Field(default=None, max_length=100)


class AuthUser(BaseModel):
    userId: int
    nickname: str


class SocialLoginResponse(BaseModel):
    accessToken: str
    refreshToken: str
    isNewUser: bool
    user: AuthUser


class RefreshRequest(BaseModel):
    refreshToken: str
    deviceUuid: str


class LogoutRequest(BaseModel):
    refreshToken: str
    deviceUuid: str


class FamilyProfileCreate(BaseModel):
    profileName: str = Field(..., min_length=1, max_length=100)
    relationType: str | None = Field(default=None, max_length=30)
    birthYear: int | None = None
    birthMonth: int | None = None
    gender: str | None = Field(default=None, max_length=20)
    memo: str | None = None


class FamilyProfileRead(BaseModel):
    profileId: int
    profileName: str
    relationType: str | None
    birthYear: int | None
    birthMonth: int | None
    gender: str | None
    memo: str | None
    isDefault: bool


class GuestDataMigrationRequest(BaseModel):
    guestId: str
    userId: int | None = None
    favorites: list[dict] = []
    recentPlaces: list[dict] = []
    familyProfiles: list[dict] = []
