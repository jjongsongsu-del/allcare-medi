from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db import get_db
from app.kdca_health_info import seed_health_info_metadata, sync_health_info_details, sync_single_health_info_detail
from app.models import HealthInfoContent
from app.schemas import HealthInfoContentRead, HealthInfoContentUpdate, HealthInfoSyncResult

router = APIRouter(prefix="/health-contents", tags=["health-contents"])
admin_router = APIRouter(prefix="/admin/health-contents", tags=["admin-health-contents"])


@router.get("", response_model=list[HealthInfoContentRead])
def list_health_contents(
    query: str | None = None,
    category: str | None = None,
    limit: int = 20,
    db: Session = Depends(get_db),
) -> list[HealthInfoContentRead]:
    rows = _query_contents(db, query=query, category=category, limit=limit).all()
    return [_to_read(row) for row in rows]


@router.get("/{content_serial}", response_model=HealthInfoContentRead)
def get_health_content(content_serial: str, db: Session = Depends(get_db)) -> HealthInfoContentRead:
    content = db.query(HealthInfoContent).filter(HealthInfoContent.content_serial == content_serial).first()
    if content is None:
        raise HTTPException(status_code=404, detail="건강정보 콘텐츠를 찾을 수 없습니다.")
    return _to_read(content, include_text=True)


@admin_router.get("", response_model=list[HealthInfoContentRead])
def admin_list_health_contents(
    query: str | None = None,
    category: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> list[HealthInfoContentRead]:
    rows = _query_contents(db, query=query, category=category, limit=limit).all()
    return [_to_read(row) for row in rows]


@admin_router.post("/seed", response_model=HealthInfoSyncResult)
def admin_seed_health_contents(db: Session = Depends(get_db)) -> HealthInfoSyncResult:
    before = db.query(HealthInfoContent).count()
    changed = seed_health_info_metadata(db)
    after = db.query(HealthInfoContent).count()
    return HealthInfoSyncResult(total=after, updated=changed, failed=0 if after >= before else before - after)


@admin_router.post("/sync", response_model=HealthInfoSyncResult)
async def admin_sync_health_contents(limit: int | None = None, db: Session = Depends(get_db)) -> HealthInfoSyncResult:
    if db.query(HealthInfoContent).count() == 0:
        seed_health_info_metadata(db)
    result = await sync_health_info_details(db, limit=limit)
    return HealthInfoSyncResult(**result)


@admin_router.patch("/{content_serial}", response_model=HealthInfoContentRead)
def admin_update_health_content(
    content_serial: str,
    payload: HealthInfoContentUpdate,
    db: Session = Depends(get_db),
) -> HealthInfoContentRead:
    content = db.query(HealthInfoContent).filter(HealthInfoContent.content_serial == content_serial).first()
    if content is None:
        raise HTTPException(status_code=404, detail="건강정보 콘텐츠를 찾을 수 없습니다.")
    if payload.sourceUrl is not None:
        content.source_url = payload.sourceUrl
    if payload.apiEnabled is not None:
        content.api_enabled = payload.apiEnabled
    db.add(content)
    db.commit()
    db.refresh(content)
    return _to_read(content)


@admin_router.post("/{content_serial}/sync", response_model=HealthInfoContentRead)
async def admin_sync_single_health_content(content_serial: str, db: Session = Depends(get_db)) -> HealthInfoContentRead:
    content = db.query(HealthInfoContent).filter(HealthInfoContent.content_serial == content_serial).first()
    if content is None:
        raise HTTPException(status_code=404, detail="건강정보 콘텐츠를 찾을 수 없습니다.")
    try:
        synced = await sync_single_health_info_detail(db, content)
        return _to_read(synced)
    except Exception as exc:
        content.sync_status = "failed"
        content.summary = f"상세 동기화 실패: {exc}"
        db.add(content)
        db.commit()
        raise HTTPException(status_code=502, detail=f"KDCA 건강정보 상세 갱신에 실패했습니다. {exc}") from exc


def _query_contents(db: Session, query: str | None, category: str | None, limit: int):
    rows = db.query(HealthInfoContent).filter(HealthInfoContent.api_enabled.is_(True))
    if query:
        like = f"%{query.strip()}%"
        rows = rows.filter(or_(HealthInfoContent.title.ilike(like), HealthInfoContent.category.ilike(like), HealthInfoContent.superclass.ilike(like), HealthInfoContent.summary.ilike(like), HealthInfoContent.content_text.ilike(like)))
    if category:
        rows = rows.filter(HealthInfoContent.category == category)
    return rows.order_by(HealthInfoContent.sync_status.desc(), HealthInfoContent.id.asc()).limit(max(1, min(limit, 200)))


def _to_read(content: HealthInfoContent, include_text: bool = False) -> HealthInfoContentRead:
    return HealthInfoContentRead(
        id=content.id,
        contentSerial=content.content_serial,
        title=content.title,
        apiEnabled=content.api_enabled,
        category=content.category,
        categoryCode=content.category_code,
        superclass=content.superclass,
        superclassCode=content.superclass_code,
        sourceUrl=content.source_url,
        summary=content.summary,
        contentText=content.content_text if include_text else None,
        syncStatus=content.sync_status,
        lastSyncedAt=content.last_synced_at.isoformat() if content.last_synced_at else None,
    )
