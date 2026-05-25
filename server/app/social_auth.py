from __future__ import annotations

from dataclasses import dataclass

import httpx
from fastapi import HTTPException

from app.config import get_settings


@dataclass
class SocialProfile:
    provider_user_id: str
    email: str | None = None
    nickname: str | None = None
    profile_image_url: str | None = None


def verify_social_login(
    *,
    provider: str,
    token_type: str,
    provider_token: str | None,
    authorization_code: str | None,
    redirect_uri: str | None,
    oauth_state: str | None,
) -> SocialProfile:
    if provider == "GOOGLE":
        token = provider_token
        if not token:
            raise HTTPException(status_code=400, detail="Google id token is required.")
        return _verify_google_id_token(token)

    if provider == "KAKAO":
        access_token = _resolve_access_token(
            provider=provider,
            token_type=token_type,
            provider_token=provider_token,
            authorization_code=authorization_code,
            redirect_uri=redirect_uri,
            oauth_state=oauth_state,
        )
        return _verify_kakao_access_token(access_token)

    if provider == "NAVER":
        access_token = _resolve_access_token(
            provider=provider,
            token_type=token_type,
            provider_token=provider_token,
            authorization_code=authorization_code,
            redirect_uri=redirect_uri,
            oauth_state=oauth_state,
        )
        return _verify_naver_access_token(access_token)

    raise HTTPException(status_code=400, detail="Unsupported social provider.")


def _resolve_access_token(
    *,
    provider: str,
    token_type: str,
    provider_token: str | None,
    authorization_code: str | None,
    redirect_uri: str | None,
    oauth_state: str | None,
) -> str:
    if token_type == "ACCESS_TOKEN":
        if not provider_token:
            raise HTTPException(status_code=400, detail=f"{provider} access token is required.")
        return provider_token

    if token_type != "AUTHORIZATION_CODE":
        raise HTTPException(status_code=400, detail=f"{provider} requires an access token or authorization code.")

    if provider == "KAKAO":
        return _exchange_kakao_code(authorization_code=authorization_code, redirect_uri=redirect_uri)

    if provider == "NAVER":
        return _exchange_naver_code(
            authorization_code=authorization_code,
            redirect_uri=redirect_uri,
            oauth_state=oauth_state,
        )

    raise HTTPException(status_code=400, detail="Unsupported authorization code exchange.")


def _verify_google_id_token(id_token: str) -> SocialProfile:
    settings = get_settings()
    allowed_audiences = {value for value in [settings.google_android_client_id, settings.google_web_client_id] if value}
    if not allowed_audiences:
        raise HTTPException(status_code=503, detail="Google login is not configured.")

    with httpx.Client(timeout=8.0) as client:
        response = client.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": id_token})
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token.")

    payload = response.json()
    if payload.get("aud") not in allowed_audiences:
        raise HTTPException(status_code=401, detail="Google token audience mismatch.")
    provider_user_id = payload.get("sub")
    if not provider_user_id:
        raise HTTPException(status_code=401, detail="Google token has no subject.")

    return SocialProfile(
        provider_user_id=str(provider_user_id),
        email=payload.get("email"),
        nickname=payload.get("name") or payload.get("email"),
        profile_image_url=payload.get("picture"),
    )


def _exchange_kakao_code(*, authorization_code: str | None, redirect_uri: str | None) -> str:
    settings = get_settings()
    if not settings.kakao_rest_api_key:
        raise HTTPException(status_code=503, detail="Kakao login is not configured.")
    if not authorization_code or not redirect_uri:
        raise HTTPException(status_code=400, detail="Kakao authorization code and redirect URI are required.")

    data = {
        "grant_type": "authorization_code",
        "client_id": settings.kakao_rest_api_key,
        "redirect_uri": redirect_uri,
        "code": authorization_code,
    }
    if settings.kakao_client_secret:
        data["client_secret"] = settings.kakao_client_secret

    with httpx.Client(timeout=8.0) as client:
        response = client.post("https://kauth.kakao.com/oauth/token", data=data)
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Kakao token exchange failed.")
    access_token = response.json().get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Kakao access token was not issued.")
    return access_token


def _verify_kakao_access_token(access_token: str) -> SocialProfile:
    with httpx.Client(timeout=8.0) as client:
        response = client.get(
            "https://kapi.kakao.com/v2/user/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Kakao token.")

    payload = response.json()
    provider_user_id = payload.get("id")
    if not provider_user_id:
        raise HTTPException(status_code=401, detail="Kakao response has no user id.")
    account = payload.get("kakao_account") or {}
    profile = account.get("profile") or {}
    return SocialProfile(
        provider_user_id=str(provider_user_id),
        email=account.get("email"),
        nickname=profile.get("nickname"),
        profile_image_url=profile.get("profile_image_url") or profile.get("thumbnail_image_url"),
    )


def _exchange_naver_code(*, authorization_code: str | None, redirect_uri: str | None, oauth_state: str | None) -> str:
    settings = get_settings()
    if not settings.naver_client_id or not settings.naver_client_secret:
        raise HTTPException(status_code=503, detail="Naver login is not configured.")
    if not authorization_code:
        raise HTTPException(status_code=400, detail="Naver authorization code is required.")

    params = {
        "grant_type": "authorization_code",
        "client_id": settings.naver_client_id,
        "client_secret": settings.naver_client_secret,
        "code": authorization_code,
    }
    if oauth_state:
        params["state"] = oauth_state
    if redirect_uri:
        params["redirect_uri"] = redirect_uri

    with httpx.Client(timeout=8.0) as client:
        response = client.get("https://nid.naver.com/oauth2.0/token", params=params)
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Naver token exchange failed.")
    access_token = response.json().get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Naver access token was not issued.")
    return access_token


def _verify_naver_access_token(access_token: str) -> SocialProfile:
    with httpx.Client(timeout=8.0) as client:
        response = client.get(
            "https://openapi.naver.com/v1/nid/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Naver token.")

    payload = response.json()
    profile = payload.get("response") or {}
    provider_user_id = profile.get("id")
    if not provider_user_id:
        raise HTTPException(status_code=401, detail="Naver response has no user id.")
    return SocialProfile(
        provider_user_id=str(provider_user_id),
        email=profile.get("email"),
        nickname=profile.get("nickname") or profile.get("name"),
        profile_image_url=profile.get("profile_image"),
    )
