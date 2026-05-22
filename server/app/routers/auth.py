from datetime import datetime, timedelta
import hashlib
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import RefreshToken, User, UserDevice, UserSocialAccount
from app.schemas import AuthUser, LogoutRequest, RefreshRequest, SocialLoginRequest, SocialLoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/social-login", response_model=SocialLoginResponse)
def social_login(payload: SocialLoginRequest, db: Session = Depends(get_db)) -> SocialLoginResponse:
    provider_user_id = _provider_user_id(payload.provider, payload.idToken)
    social = (
        db.query(UserSocialAccount)
        .filter(UserSocialAccount.provider == payload.provider, UserSocialAccount.provider_user_id == provider_user_id)
        .first()
    )

    is_new_user = social is None
    if social is None:
        user = User(
            display_name=f"{payload.provider} 사용자",
            nickname=f"{payload.provider.title()} 사용자",
            status="ACTIVE",
        )
        db.add(user)
        db.flush()
        social = UserSocialAccount(
            user_id=user.id,
            provider=payload.provider,
            provider_user_id=provider_user_id,
        )
        db.add(social)
    else:
        user = social.user

    device = (
        db.query(UserDevice)
        .filter(UserDevice.user_id == user.id, UserDevice.device_uuid == payload.deviceUuid)
        .first()
    )
    if device is None:
        device = UserDevice(user_id=user.id, device_uuid=payload.deviceUuid)
        db.add(device)
        db.flush()

    device.device_name = payload.deviceName
    device.push_token = payload.pushToken
    device.last_login_at = datetime.utcnow()
    device.is_active = True

    access_token = secrets.token_urlsafe(32)
    refresh_token = secrets.token_urlsafe(48)
    db.add(
        RefreshToken(
            user_id=user.id,
            device_id=device.id,
            token_hash=_hash_token(refresh_token),
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
    )
    db.commit()

    return SocialLoginResponse(
        accessToken=access_token,
        refreshToken=refresh_token,
        isNewUser=is_new_user,
        user=AuthUser(userId=user.id, nickname=user.nickname or user.display_name),
    )


@router.post("/refresh", response_model=SocialLoginResponse)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)) -> SocialLoginResponse:
    token = _active_refresh_token(payload.refreshToken, db)
    if token is None or token.device.device_uuid != payload.deviceUuid:
        raise HTTPException(status_code=401, detail="Invalid refresh token.")

    token.revoked_at = datetime.utcnow()
    access_token = secrets.token_urlsafe(32)
    next_refresh_token = secrets.token_urlsafe(48)
    db.add(
        RefreshToken(
            user_id=token.user_id,
            device_id=token.device_id,
            token_hash=_hash_token(next_refresh_token),
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
    )
    db.commit()

    user = token.device.user
    return SocialLoginResponse(
        accessToken=access_token,
        refreshToken=next_refresh_token,
        isNewUser=False,
        user=AuthUser(userId=user.id, nickname=user.nickname or user.display_name),
    )


@router.post("/logout")
def logout(payload: LogoutRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    token = _active_refresh_token(payload.refreshToken, db)
    if token is not None and token.device.device_uuid == payload.deviceUuid:
        token.revoked_at = datetime.utcnow()
        db.commit()
    return {"status": "ok"}


def _provider_user_id(provider: str, id_token: str) -> str:
    return hashlib.sha256(f"{provider}:{id_token}".encode("utf-8")).hexdigest()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _active_refresh_token(token: str, db: Session) -> RefreshToken | None:
    token_hash = _hash_token(token)
    return (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.utcnow(),
        )
        .first()
    )
