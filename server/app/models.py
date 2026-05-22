from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nickname: Mapped[str | None] = mapped_column(String(100), nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    care_profile: Mapped[str] = mapped_column(String(40), default="self")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    medications: Mapped[list["Medication"]] = relationship(back_populates="user")
    social_accounts: Mapped[list["UserSocialAccount"]] = relationship(back_populates="user")
    devices: Mapped[list["UserDevice"]] = relationship(back_populates="user")
    family_profiles: Mapped[list["FamilyProfile"]] = relationship(back_populates="user")


class UserSocialAccount(Base):
    __tablename__ = "user_social_accounts"
    __table_args__ = (UniqueConstraint("provider", "provider_user_id", name="uq_provider_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    connected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="social_accounts")


class UserDevice(Base):
    __tablename__ = "user_devices"
    __table_args__ = (UniqueConstraint("user_id", "device_uuid", name="uq_user_device_uuid"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    device_uuid: Mapped[str] = mapped_column(String(255), nullable=False)
    device_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    push_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_login_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(back_populates="devices")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="device")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    device_id: Mapped[int] = mapped_column(ForeignKey("user_devices.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    device: Mapped["UserDevice"] = relationship(back_populates="refresh_tokens")


class FamilyProfile(Base):
    __tablename__ = "family_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    profile_name: Mapped[str] = mapped_column(String(100), nullable=False)
    relation_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    birth_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="family_profiles")
    medical_notes: Mapped[list["ProfileMedicalNote"]] = relationship(back_populates="profile")


class ProfileMedicalNote(Base):
    __tablename__ = "profile_medical_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("family_profiles.id"), nullable=False)
    note_type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["FamilyProfile"] = relationship(back_populates="medical_notes")


class FavoritePlace(Base):
    __tablename__ = "favorite_places"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    profile_id: Mapped[int | None] = mapped_column(ForeignKey("family_profiles.id"), nullable=True)
    place_id: Mapped[str] = mapped_column(String(100), nullable=False)
    place_type: Mapped[str] = mapped_column(String(30), nullable=False)
    memo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RecentPlace(Base):
    __tablename__ = "recent_places"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    place_id: Mapped[str] = mapped_column(String(100), nullable=False)
    place_name: Mapped[str] = mapped_column(String(160), nullable=False)
    place_type: Mapped[str] = mapped_column(String(30), nullable=False)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(80), nullable=True)
    viewed_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MedicineSearchHistory(Base):
    __tablename__ = "medicine_search_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    profile_id: Mapped[int | None] = mapped_column(ForeignKey("family_profiles.id"), nullable=True)
    medicine_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    search_type: Mapped[str] = mapped_column(String(30), nullable=False)
    confidence: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


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
