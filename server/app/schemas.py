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
