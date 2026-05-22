from pydantic import BaseModel, Field


class HealthCheck(BaseModel):
    status: str
    db: str


class MedicationCreate(BaseModel):
    user_id: int = Field(..., ge=1)
    profile_id: int | None = None
    name: str = Field(..., min_length=1, max_length=160)
    alias: str | None = Field(default=None, max_length=160)
    product_name: str | None = Field(default=None, max_length=160)
    ingredient: str | None = Field(default=None, max_length=200)
    manufacturer: str | None = Field(default=None, max_length=120)
    dosage: str | None = Field(default=None, max_length=80)
    form: str | None = Field(default=None, max_length=80)
    color: str | None = Field(default=None, max_length=80)
    imprint: str | None = Field(default=None, max_length=120)
    image_url: str | None = None
    purpose: str | None = Field(default=None, max_length=160)
    taking_method: str | None = Field(default=None, max_length=40)
    timing: str | None = Field(default=None, max_length=40)
    memo: str | None = None
    caution: str | None = None
    side_effects: str | None = None
    storage_method: str | None = None
    dur_warnings: str | None = None
    status: str = Field(default="taking", max_length=20)
    source: str = Field(default="manual", max_length=40)
    favorite: bool = False
    high_risk: bool = False
    safety_note: str | None = None


class MedicationRead(BaseModel):
    id: int
    user_id: int
    profile_id: int | None
    name: str
    alias: str | None
    product_name: str | None
    ingredient: str | None
    manufacturer: str | None
    dosage: str | None
    form: str | None
    color: str | None
    imprint: str | None
    image_url: str | None
    purpose: str | None
    taking_method: str | None
    timing: str | None
    memo: str | None
    caution: str | None
    side_effects: str | None
    storage_method: str | None
    dur_warnings: str | None
    status: str
    source: str
    favorite: bool
    high_risk: bool
    safety_note: str | None

    model_config = {"from_attributes": True}


class MedicineSearchResultRead(BaseModel):
    id: str
    name: str
    product_name: str | None = None
    ingredient: str | None = None
    manufacturer: str | None = None
    dosage: str | None = None
    form: str | None = None
    color: str | None = None
    imprint: str | None = None
    image_url: str | None = None
    source: str = "fallback"


class MedicationScheduleCreate(BaseModel):
    medication_id: int = Field(..., ge=1)
    profile_id: int | None = None
    dose_amount: str = Field(..., min_length=1, max_length=80)
    dose_method: str = Field(..., min_length=1, max_length=80)
    dose_timing: str = Field(..., min_length=1, max_length=80)
    purpose: str | None = Field(default=None, max_length=160)
    times_per_day: int = Field(default=1, ge=1, le=12)
    dose_times: list[str] = []
    starts_on: str = Field(..., min_length=4, max_length=10)
    ends_on: str | None = Field(default=None, max_length=10)
    duration_days: int | None = None
    repeat_rule: str = Field(default="daily", max_length=30)
    notify_enabled: bool = True
    notification_level: str = Field(default="normal", max_length=20)


class MedicationScheduleRead(BaseModel):
    id: int
    medication_id: int
    profile_id: int | None
    dose_amount: str
    dose_method: str
    dose_timing: str
    purpose: str | None
    times_per_day: int
    dose_times: list[str]
    starts_on: str
    ends_on: str | None
    duration_days: int | None
    repeat_rule: str
    notify_enabled: bool
    notification_level: str

    model_config = {"from_attributes": True}


class MedicationEventCreate(BaseModel):
    medication_id: int = Field(..., ge=1)
    schedule_id: int | None = None
    profile_id: int | None = None
    scheduled_at: str = Field(..., min_length=4, max_length=40)
    status: str = Field(default="pending", max_length=20)
    taken_at: str | None = Field(default=None, max_length=40)
    shared_with_guardian: bool = False
    memo: str | None = None


class MedicationEventRead(BaseModel):
    id: int
    medication_id: int
    schedule_id: int | None
    profile_id: int | None
    scheduled_at: str
    status: str
    taken_at: str | None
    shared_with_guardian: bool
    memo: str | None

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
    birthDate: str | None = Field(default=None, max_length=10)
    birthYear: int | None = None
    birthMonth: int | None = None
    gender: str | None = Field(default=None, max_length=20)
    phone: str | None = Field(default=None, max_length=80)
    memo: str | None = None
    bloodType: str | None = Field(default=None, max_length=10)
    allergies: str | None = None
    chronicDiseases: str | None = None
    currentMedications: str | None = None
    emergencyContact: str | None = Field(default=None, max_length=120)
    favoriteHospital: str | None = Field(default=None, max_length=160)
    favoritePharmacy: str | None = Field(default=None, max_length=160)
    canView: bool = True
    canEdit: bool = True
    canReceiveAlert: bool = False
    canViewEmergency: bool = True


class FamilyProfileRead(BaseModel):
    profileId: int
    profileName: str
    relationType: str | None
    birthDate: str | None
    birthYear: int | None
    birthMonth: int | None
    gender: str | None
    phone: str | None
    memo: str | None
    isDefault: bool
    bloodType: str | None
    allergies: str | None
    chronicDiseases: str | None
    currentMedications: str | None
    emergencyContact: str | None
    favoriteHospital: str | None
    favoritePharmacy: str | None
    canView: bool
    canEdit: bool
    canReceiveAlert: bool
    canViewEmergency: bool
    consentStatus: str


class GuestDataMigrationRequest(BaseModel):
    guestId: str
    userId: int | None = None
    favorites: list[dict] = []
    recentPlaces: list[dict] = []
    familyProfiles: list[dict] = []
    medicines: list[dict] = []
    medicineSchedules: list[dict] = []
    medicationEvents: list[dict] = []
