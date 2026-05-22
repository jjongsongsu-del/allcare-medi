from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routers import admin_apis, auth, facilities, facility_reports, family_profiles, health, medications, migration

app = FastAPI(
    title="AllCareMedi BFF",
    version="0.1.0",
    description="Public healthcare API, AI, OCR, DUR, and medication management gateway."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(admin_apis.router)
app.include_router(facilities.router)
app.include_router(medications.router)
app.include_router(facility_reports.router)
app.include_router(family_profiles.router)
app.include_router(migration.router)
