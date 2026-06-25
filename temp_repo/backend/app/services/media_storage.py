from pathlib import Path
from uuid import uuid4

from app.config import get_settings


class LocalMediaStorage:
    def __init__(self, media_dir: str) -> None:
        self.media_dir = Path(media_dir)

    def save(self, original_filename: str, content: bytes) -> tuple[str, str]:
        self.media_dir.mkdir(parents=True, exist_ok=True)
        extension = Path(original_filename or "image").suffix.lower() or ".jpg"
        stored_filename = f"{uuid4().hex}{extension}"
        file_path = self.media_dir / stored_filename
        file_path.write_bytes(content)
        return stored_filename, str(file_path)

    def delete(self, file_path: str) -> None:
        Path(file_path).unlink(missing_ok=True)


def get_media_storage() -> LocalMediaStorage:
    return LocalMediaStorage(get_settings().media_dir)
