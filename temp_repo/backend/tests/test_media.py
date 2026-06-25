from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import MediaAsset, Post, Store
from app.routes.media import delete_media, media_response, update_media_metadata
from app.schemas import MediaMetadataRequest
from app.services.media_storage import LocalMediaStorage


def test_local_media_storage_saves_and_deletes_file(tmp_path) -> None:
    storage = LocalMediaStorage(str(tmp_path))

    stored_filename, file_path = storage.save("hero.webp", b"image")

    assert stored_filename.endswith(".webp")
    assert (tmp_path / stored_filename).read_bytes() == b"image"

    storage.delete(file_path)

    assert not (tmp_path / stored_filename).exists()


def test_update_media_metadata_and_response() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime(2026, 1, 1, 12, 0, 0)

    with session_factory() as db:
        store = Store(name="Main", created_at=now, updated_at=now)
        db.add(store)
        db.flush()

        asset = MediaAsset(
            store_id=store.id,
            original_filename="launch.webp",
            stored_filename="launch.webp",
            file_path="/tmp/launch.webp",
            content_type="image/webp",
            size_bytes=100,
            created_at=now,
        )
        db.add(asset)
        db.commit()

        response = update_media_metadata(
            asset.id,
            MediaMetadataRequest(folder="  کمپین خرداد  ", tags="  محصول، لانچ  "),
            store=store,
            db=db,
        )

        assert response.folder == "کمپین خرداد"
        assert response.tags == "محصول، لانچ"
        assert media_response(asset).folder == "کمپین خرداد"


def test_delete_media_blocks_attached_asset_until_forced(tmp_path) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime(2026, 1, 1, 12, 0, 0)
    file_path = tmp_path / "attached.webp"
    file_path.write_bytes(b"image")

    with session_factory() as db:
        store = Store(name="Main", created_at=now, updated_at=now)
        db.add(store)
        db.flush()

        post = Post(store_id=store.id, title="Launch post", created_at=now, updated_at=now)
        db.add(post)
        db.flush()

        asset = MediaAsset(
            store_id=store.id,
            post_id=post.id,
            original_filename="attached.webp",
            stored_filename="attached.webp",
            file_path=str(file_path),
            content_type="image/webp",
            size_bytes=100,
            created_at=now,
        )
        db.add(asset)
        db.commit()
        asset_id = asset.id

        with pytest.raises(HTTPException) as exc_info:
            delete_media(asset_id, store=store, db=db)

        assert exc_info.value.status_code == 409
        assert file_path.exists()

        response = delete_media(asset_id, force=True, store=store, db=db)

        assert response == {"deleted": True, "id": asset_id}
        assert not file_path.exists()
        assert db.get(MediaAsset, asset_id) is None
