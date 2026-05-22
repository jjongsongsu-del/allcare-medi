from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models

    Base.metadata.create_all(bind=engine)
    if settings.database_url.startswith("sqlite"):
        _ensure_sqlite_user_columns()
        _ensure_sqlite_medication_columns()


def _ensure_sqlite_user_columns() -> None:
    columns = {
        "email": "VARCHAR(255)",
        "nickname": "VARCHAR(100)",
        "profile_image_url": "TEXT",
        "status": "VARCHAR(20) DEFAULT 'ACTIVE'",
        "updated_at": "DATETIME",
    }
    family_profile_columns = {
        "birth_date": "VARCHAR(10)",
        "phone": "VARCHAR(80)",
        "blood_type": "VARCHAR(10)",
        "allergies": "TEXT",
        "chronic_diseases": "TEXT",
        "current_medications": "TEXT",
        "emergency_contact": "VARCHAR(120)",
        "favorite_hospital": "VARCHAR(160)",
        "favorite_pharmacy": "VARCHAR(160)",
        "can_view": "BOOLEAN DEFAULT 1",
        "can_edit": "BOOLEAN DEFAULT 1",
        "can_receive_alert": "BOOLEAN DEFAULT 0",
        "can_view_emergency": "BOOLEAN DEFAULT 1",
        "consent_status": "VARCHAR(20) DEFAULT 'LOCAL_ONLY'",
    }
    with engine.begin() as connection:
        existing = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(users)").fetchall()}
        for name, ddl_type in columns.items():
            if name not in existing:
                connection.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {name} {ddl_type}")
        existing_profiles = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(family_profiles)").fetchall()}
        for name, ddl_type in family_profile_columns.items():
            if name not in existing_profiles:
                connection.exec_driver_sql(f"ALTER TABLE family_profiles ADD COLUMN {name} {ddl_type}")


def _ensure_sqlite_medication_columns() -> None:
    medication_columns = {
        "profile_id": "INTEGER",
        "name": "VARCHAR(160) DEFAULT ''",
        "alias": "VARCHAR(160)",
        "dosage": "VARCHAR(80)",
        "form": "VARCHAR(80)",
        "color": "VARCHAR(80)",
        "imprint": "VARCHAR(120)",
        "image_url": "TEXT",
        "purpose": "VARCHAR(160)",
        "taking_method": "VARCHAR(40)",
        "timing": "VARCHAR(40)",
        "memo": "TEXT",
        "caution": "TEXT",
        "side_effects": "TEXT",
        "storage_method": "TEXT",
        "dur_warnings": "TEXT",
        "status": "VARCHAR(20) DEFAULT 'taking'",
        "favorite": "BOOLEAN DEFAULT 0",
        "high_risk": "BOOLEAN DEFAULT 0",
        "updated_at": "DATETIME",
    }
    schedule_columns = {
        "profile_id": "INTEGER",
        "dose_time": "VARCHAR(5) DEFAULT '08:00'",
        "instruction": "VARCHAR(120) DEFAULT 'Take as directed'",
        "dose_amount": "VARCHAR(80) DEFAULT '1 tablet'",
        "dose_method": "VARCHAR(80) DEFAULT 'oral'",
        "dose_timing": "VARCHAR(80) DEFAULT 'after meal'",
        "purpose": "VARCHAR(160)",
        "times_per_day": "INTEGER DEFAULT 1",
        "dose_times": "TEXT DEFAULT '[]'",
        "duration_days": "INTEGER",
        "repeat_rule": "VARCHAR(30) DEFAULT 'daily'",
        "notification_level": "VARCHAR(20) DEFAULT 'normal'",
        "created_at": "DATETIME",
        "updated_at": "DATETIME",
    }
    with engine.begin() as connection:
        existing_medications = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(medications)").fetchall()}
        for name, ddl_type in medication_columns.items():
            if name not in existing_medications:
                connection.exec_driver_sql(f"ALTER TABLE medications ADD COLUMN {name} {ddl_type}")
        existing_schedules = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(medication_schedules)").fetchall()}
        for name, ddl_type in schedule_columns.items():
            if name not in existing_schedules:
                connection.exec_driver_sql(f"ALTER TABLE medication_schedules ADD COLUMN {name} {ddl_type}")
