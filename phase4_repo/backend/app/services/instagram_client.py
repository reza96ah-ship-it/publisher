from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import httpx

from app.config import get_settings


@dataclass(frozen=True)
class InstagramSendResult:
    ok: bool
    message_id: str = ""
    comment_id: str = ""
    error: str = ""
    raw: dict | None = None


@dataclass(frozen=True)
class InstagramOAuthTokenResult:
    ok: bool
    access_token: str = ""
    token_type: str = ""
    expires_at: datetime | None = None
    error: str = ""
    raw: dict | None = None


@dataclass(frozen=True)
class InstagramPageConnection:
    ok: bool
    page_id: str = ""
    page_name: str = ""
    page_access_token: str = ""
    professional_account_id: str = ""
    username: str = ""
    error: str = ""
    raw: dict | None = None


class InstagramGraphClient:
    def __init__(
        self,
        graph_base_url: str | None = None,
        instagram_base_url: str | None = None,
        api_version: str | None = None,
        timeout: float = 20.0,
    ) -> None:
        settings = get_settings()
        self.graph_base_url = (graph_base_url or settings.meta_graph_base_url).rstrip("/")
        self.instagram_base_url = (instagram_base_url or settings.instagram_graph_base_url).rstrip("/")
        self.api_version = (api_version or settings.meta_graph_api_version).strip("/")
        self.timeout = timeout

    def exchange_code_for_user_token(self, app_id: str, app_secret: str, redirect_uri: str, code: str) -> InstagramOAuthTokenResult:
        return self._get_token(
            f"{self.graph_base_url}/{self.api_version}/oauth/access_token",
            {
                "client_id": app_id,
                "client_secret": app_secret,
                "redirect_uri": redirect_uri,
                "code": code,
            },
        )

    def exchange_long_lived_user_token(self, app_id: str, app_secret: str, short_lived_token: str) -> InstagramOAuthTokenResult:
        return self._get_token(
            f"{self.graph_base_url}/{self.api_version}/oauth/access_token",
            {
                "grant_type": "fb_exchange_token",
                "client_id": app_id,
                "client_secret": app_secret,
                "fb_exchange_token": short_lived_token,
            },
        )

    def _get_token(self, url: str, params: dict[str, str]) -> InstagramOAuthTokenResult:
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(url, params=params)
                data = response.json() if response.content else {}
                if response.is_error:
                    error = data.get("error", {}).get("message") if isinstance(data, dict) else ""
                    return InstagramOAuthTokenResult(ok=False, error=error or response.text or "Meta OAuth token exchange failed", raw=data)
                expires_in = int(data.get("expires_in") or 0) if isinstance(data, dict) else 0
                expires_at = datetime.utcnow() + timedelta(seconds=expires_in) if expires_in else None
                return InstagramOAuthTokenResult(
                    ok=True,
                    access_token=str(data.get("access_token") or "") if isinstance(data, dict) else "",
                    token_type=str(data.get("token_type") or "") if isinstance(data, dict) else "",
                    expires_at=expires_at,
                    raw=data if isinstance(data, dict) else {},
                )
        except (httpx.HTTPError, ValueError) as exc:
            return InstagramOAuthTokenResult(ok=False, error=str(exc))

    def find_instagram_page_connection(self, user_access_token: str) -> InstagramPageConnection:
        if not user_access_token:
            return InstagramPageConnection(ok=False, error="Meta user access token is required")
        fields = "id,name,access_token,instagram_business_account{id,username},connected_instagram_account{id,username}"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(
                    f"{self.graph_base_url}/{self.api_version}/me/accounts",
                    params={"fields": fields, "access_token": user_access_token},
                )
                data = response.json() if response.content else {}
                if response.is_error:
                    error = data.get("error", {}).get("message") if isinstance(data, dict) else ""
                    return InstagramPageConnection(ok=False, error=error or response.text or "Meta page lookup failed", raw=data)
                pages = data.get("data", []) if isinstance(data, dict) else []
                for page in pages:
                    if not isinstance(page, dict):
                        continue
                    ig_account = self._extract_instagram_account(page)
                    if not ig_account:
                        continue
                    return InstagramPageConnection(
                        ok=True,
                        page_id=str(page.get("id") or ""),
                        page_name=str(page.get("name") or ""),
                        page_access_token=str(page.get("access_token") or ""),
                        professional_account_id=str(ig_account.get("id") or ""),
                        username=str(ig_account.get("username") or ""),
                        raw=page,
                    )
                return InstagramPageConnection(ok=False, error="No Facebook Page with a linked Instagram professional account was found", raw=data)
        except (httpx.HTTPError, ValueError) as exc:
            return InstagramPageConnection(ok=False, error=str(exc))

    def _extract_instagram_account(self, page: dict[str, Any]) -> dict[str, Any] | None:
        for key in ("instagram_business_account", "connected_instagram_account"):
            account = page.get(key)
            if isinstance(account, dict) and account.get("id"):
                return account
        return None

    def send_private_reply(self, page_id: str, access_token: str, comment_id: str, text: str) -> InstagramSendResult:
        if not page_id:
            return InstagramSendResult(ok=False, error="Facebook Page ID is required for Instagram private replies")
        if not access_token:
            return InstagramSendResult(ok=False, error="Meta access token is required for Instagram private replies")
        if not comment_id:
            return InstagramSendResult(ok=False, error="Instagram comment ID is required for private replies")
        if not text.strip():
            return InstagramSendResult(ok=False, error="Private reply message is empty")

        url = f"{self.graph_base_url}/{self.api_version}/{page_id}/messages"
        payload = {
            "recipient": {"comment_id": comment_id},
            "message": {"text": text.strip()},
        }
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(url, json=payload, params={"access_token": access_token})
                data = response.json() if response.content else {}
                if response.is_error:
                    error = data.get("error", {}).get("message") if isinstance(data, dict) else ""
                    return InstagramSendResult(ok=False, error=error or response.text or "Meta private reply failed", raw=data)
                message_id = ""
                if isinstance(data, dict):
                    message_id = str(data.get("message_id") or data.get("recipient_id") or data.get("id") or "")
                return InstagramSendResult(ok=True, message_id=message_id, raw=data if isinstance(data, dict) else {})
        except httpx.HTTPError as exc:
            return InstagramSendResult(ok=False, error=str(exc))

    def send_direct_message(self, page_id: str, access_token: str, recipient_id: str, text: str) -> InstagramSendResult:
        if not page_id:
            return InstagramSendResult(ok=False, error="Facebook Page ID is required for Instagram direct messages")
        if not access_token:
            return InstagramSendResult(ok=False, error="Meta access token is required for Instagram direct messages")
        if not recipient_id:
            return InstagramSendResult(ok=False, error="Recipient ID is required for direct messages")
        if not text.strip():
            return InstagramSendResult(ok=False, error="Direct message text is empty")

        url = f"{self.graph_base_url}/{self.api_version}/{page_id}/messages"
        payload = {
            "recipient": {"id": recipient_id},
            "message": {"text": text.strip()},
        }
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(url, json=payload, params={"access_token": access_token})
                data = response.json() if response.content else {}
                if response.is_error:
                    error = data.get("error", {}).get("message") if isinstance(data, dict) else ""
                    return InstagramSendResult(ok=False, error=error or response.text or "Meta direct message failed", raw=data)
                message_id = ""
                if isinstance(data, dict):
                    message_id = str(data.get("message_id") or data.get("recipient_id") or data.get("id") or "")
                return InstagramSendResult(ok=True, message_id=message_id, raw=data if isinstance(data, dict) else {})
        except httpx.HTTPError as exc:
            return InstagramSendResult(ok=False, error=str(exc))

    def send_public_comment_reply(self, access_token: str, comment_id: str, text: str) -> InstagramSendResult:
        if not access_token:
            return InstagramSendResult(ok=False, error="Meta access token is required for public comment replies")
        if not comment_id:
            return InstagramSendResult(ok=False, error="Instagram comment ID is required for comment replies")
        if not text.strip():
            return InstagramSendResult(ok=False, error="Public reply message is empty")

        url = f"{self.instagram_base_url}/{self.api_version}/{comment_id}/replies"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(url, json={"message": text.strip()}, params={"access_token": access_token})
                data = response.json() if response.content else {}
                if response.is_error:
                    error = data.get("error", {}).get("message") if isinstance(data, dict) else ""
                    return InstagramSendResult(ok=False, error=error or response.text or "Meta public reply failed", raw=data)
                reply_id = str(data.get("id") or "") if isinstance(data, dict) else ""
                return InstagramSendResult(ok=True, comment_id=reply_id, raw=data if isinstance(data, dict) else {})
        except httpx.HTTPError as exc:
            return InstagramSendResult(ok=False, error=str(exc))
