from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import FacilityReport
from app.schemas import FacilityReportCreate, FacilityReportRead, FacilityReportUpdate

router = APIRouter(prefix="/facility-reports", tags=["facility-reports"])


@router.post("", response_model=FacilityReportRead)
def create_facility_report(payload: FacilityReportCreate, db: Session = Depends(get_db)) -> FacilityReport:
    report = FacilityReport(**payload.model_dump())
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("", response_model=list[FacilityReportRead])
def list_facility_reports(db: Session = Depends(get_db)) -> list[FacilityReport]:
    return db.query(FacilityReport).order_by(FacilityReport.id.desc()).all()


@router.patch("/{report_id}", response_model=FacilityReportRead)
def update_facility_report(report_id: int, payload: FacilityReportUpdate, db: Session = Depends(get_db)) -> FacilityReport:
    report = db.get(FacilityReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Facility report not found.")
    report.status = payload.status
    db.commit()
    db.refresh(report)
    return report
