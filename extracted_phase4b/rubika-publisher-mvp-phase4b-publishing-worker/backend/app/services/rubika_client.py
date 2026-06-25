from pathlib import Path

import httpx

from app.config import get_settings

settings = get_settings()


class RubikaClient:
    def __init__(self, token: str):
        self.token = token.strip()
        self.base_url = settings.rubika_api_base_url.rstrip("/")

    def _url(self, method: str) -> str:
        return f"{self.base_url}/{self.token}/{method}"

    async def get_me(self) -> dict:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(self._url("getMe"), json={})
            response.raise_for_status()
            return response.json()

    async def send_message(self, chat_id: str, text: str) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                self._url("sendMessage"),
                json={"chat_id": chat_id, "text": text},
            )
            response.raise_for_status()
            return response.json()

    async def request_send_file(self, file_type: str) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(self._url("requestSendFile"), json={"type": file_type})
            response.raise_for_status()
            return response.json()

    async def upload_file(self, upload_url: str, file_path: str, content_type: str, filename: str) -> dict:
        path = Path(file_path)
        with path.open("rb") as file:
            files = {"file": (filename or path.name, file, content_type or "application/octet-stream")}
            async with httpx.AsyncClient(timeout=120) as client:
                response = await client.post(upload_url, files=files)
                response.raise_for_status()
                return response.json()

    async def send_file(self, chat_id: str, file_id: str, text: str = "") -> dict:
        payload = {"chat_id": chat_id, "file_id": file_id}
        if text:
            payload["text"] = text
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(self._url("sendFile"), json=payload)
            response.raise_for_status()
            return response.json()


def mask_token(token: str) -> str:
    value = token.strip()
    if len(value) <= 10:
        return "********"
    return f"{value[:4]}...{value[-4:]}"


def extract_bot_name(payload: dict) -> str:
    data = payload.get("data") if isinstance(payload, dict) else None
    if isinstance(data, dict):
        for key in ["username", "bot_username", "first_name", "name"]:
            value = data.get(key)
            if isinstance(value, str) and value:
                return value
    return "Rubika Bot"
