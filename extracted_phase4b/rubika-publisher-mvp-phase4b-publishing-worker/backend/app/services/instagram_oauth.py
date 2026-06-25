from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import urlencode

from app.config import get_settings


def b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("ascii"))


def sign_payload(payload: dict[str, Any], secret: str) -> str:
    body = b64url_encode(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signature = hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    return f"{body}.{b64url_encode(signature)}"


def verify_signed_payload(token: str, secret: str) -> dict[str, Any]:
    try:
        body, signature = token.split(".", 1)
    except ValueError as exc:
        raise ValueError("Invalid OAuth state") from exc
    expected = b64url_encode(hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())
    if not hmac.compare_digest(signature, expected):
        raise ValueError("Invalid OAuth state signature")
    payload = json.loads(b64url_decode(body).decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Invalid OAuth state payload")
    expires_at = int(payload.get("exp") or 0)
    if expires_at < int(datetime.utcnow().timestamp()):
        raise ValueError("OAuth state expired")
    return payload


def create_instagram_oauth_state(store_id: int, user_id: int, ttl_minutes: int = 15) -> str:
    settings = get_settings()
    expires_at = datetime.utcnow() + timedelta(minutes=ttl_minutes)
    return sign_payload(
        {
            "store_id": store_id,
            "user_id": user_id,
            "exp": int(expires_at.timestamp()),
        },
        settings.app_secret_key,
    )


def read_instagram_oauth_state(state: str) -> dict[str, Any]:
    settings = get_settings()
    return verify_signed_payload(state, settings.app_secret_key)


def build_meta_oauth_url(state: str) -> str:
    settings = get_settings()
    params = {
        "client_id": settings.meta_app_id,
        "redirect_uri": settings.meta_oauth_redirect_uri,
        "state": state,
        "scope": ",".join(settings.meta_oauth_scope_list),
        "response_type": "code",
    }
    return f"https://www.facebook.com/{settings.meta_graph_api_version}/dialog/oauth?{urlencode(params)}"


def missing_meta_oauth_config() -> list[str]:
    settings = get_settings()
    missing: list[str] = []
    if not settings.meta_app_id:
        missing.append("META_APP_ID")
    if not settings.meta_app_secret:
        missing.append("META_APP_SECRET")
    if not settings.meta_oauth_redirect_uri:
        missing.append("META_OAUTH_REDIRECT_URI")
    return missing
