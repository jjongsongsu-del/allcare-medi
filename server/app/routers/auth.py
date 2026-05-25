from __future__ import annotations

from datetime import datetime, timedelta
import hashlib
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import FamilyProfile, RefreshToken, User, UserDevice, UserSocialAccount
from app.schemas import AuthUser, LogoutRequest, RefreshRequest, SocialLoginRequest, SocialLoginResponse
from app.social_auth import verify_social_login

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/social-login", response_model=SocialLoginResponse)
def social_login(payload: SocialLoginRequest, db: Session = Depends(get_db)) -> SocialLoginResponse:
    profile = verify_social_login(
        provider=payload.provider,
        token_type=payload.tokenType,
        provider_token=payload.providerToken or payload.idToken,
        authorization_code=payload.authorizationCode,
        redirect_uri=payload.redirectUri,
        oauth_state=payload.oauthState,
    )
    provider_user_id = profile.provider_user_id
    social = (
        db.query(UserSocialAccount)
        .filter(UserSocialAccount.provider == payload.provider, UserSocialAccount.provider_user_id == provider_user_id)
        .first()
    )

    is_new_user = social is None
    if social is None:
        nickname = profile.nickname or f"{payload.provider.title()} 사용자"
        user = User(
            display_name=nickname,
            email=profile.email,
            nickname=nickname,
            profile_image_url=profile.profile_image_url,
            status="ACTIVE",
        )
        db.add(user)
        db.flush()
        social = UserSocialAccount(
            user_id=user.id,
            provider=payload.provider,
            provider_user_id=provider_user_id,
            email=profile.email,
        )
        db.add(social)
        _ensure_default_family_profile(user, db)
    else:
        user = social.user
        social.email = profile.email or social.email
        user.email = profile.email or user.email
        user.nickname = profile.nickname or user.nickname
        user.display_name = profile.nickname or user.display_name
        user.profile_image_url = profile.profile_image_url or user.profile_image_url
        user.updated_at = datetime.utcnow()

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


def _ensure_default_family_profile(user: User, db: Session) -> None:
    existing = (
        db.query(FamilyProfile)
        .filter(FamilyProfile.user_id == user.id, FamilyProfile.is_default.is_(True))
        .first()
    )
    if existing is not None:
        return
    db.add(
        FamilyProfile(
            user_id=user.id,
            profile_name="나",
            relation_type="SELF",
            is_default=True,
            can_view=True,
            can_edit=True,
            can_receive_alert=True,
            can_view_emergency=True,
            consent_status="ACCEPTED",
        )
    )


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

