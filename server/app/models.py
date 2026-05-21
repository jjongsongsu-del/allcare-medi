from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    care_profile: Mapped[str] = mapped_column(String(40), default="self")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    medications: Mapped[list["Medication"]] = relationship(back_populates="user")


class Medication(Base):
    __tablename__ = "medications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    product_name: Mapped[str] = mapped_column(String(160), nullable=False)
    ingredient: Mapped[str] = mapped_column(String(200), nullable=False)
    manufacturer: Mapped[str | None] = mapped_column(String(120), nullable=True)
    source: Mapped[str] = mapped_column(String(40), default="manual")
    safety_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="medications")
    schedules: Mapped[list["MedicationSchedule"]] = relationship(back_populates="medication")


class MedicationSchedule(Base):
    __tablename__ = "medication_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    medication_id: Mapped[int] = mapped_column(ForeignKey("medications.id"), nullable=False)
    dose_time: Mapped[str] = mapped_column(String(5), nullable=False)
    instruction: Mapped[str] = mapped_column(String(120), nullable=False)
    starts_on: Mapped[str] = mapped_column(String(10), nullable=False)
    ends_on: Mapped[str | None] = mapped_column(String(10), nullable=True)
    notify_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    medication: Mapped["Medication"] = relationship(back_populates="schedules")


class FacilityReport(Base):
    __tablename__ = "facility_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    facility_external_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    facility_name: Mapped[str] = mapped_column(String(160), nullable=False)
    report_type: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    reporter_contact: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
