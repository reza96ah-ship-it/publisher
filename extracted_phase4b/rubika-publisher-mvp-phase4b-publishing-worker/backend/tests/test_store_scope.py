from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import MediaAsset, Post, Store
from app.store_scope import find_active_store, get_store_media_asset, get_store_post, require_active_store


def session_factory():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


def test_find_active_store_returns_first_active_store() -> None:
    now = datetime(2026, 1, 1, 12, 0, 0)
    factory = session_factory()

    with factory() as db:
        inactive_store = Store(name="Inactive", is_active=False, created_at=now, updated_at=now)
        first_active_store = Store(name="First active", created_at=now, updated_at=now)
        second_active_store = Store(name="Second active", created_at=now, updated_at=now)
        db.add_all([inactive_store, first_active_store, second_active_store])
        db.commit()

        assert find_active_store(db).id == first_active_store.id
        assert require_active_store(db).id == first_active_store.id


def test_require_active_store_raises_when_missing() -> None:
    factory = session_factory()

    with factory() as db:
        with pytest.raises(HTTPException) as exc_info:
            require_active_store(db)

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == "Create store profile first"


def test_store_scoped_helpers_reject_other_store_records() -> None:
    now = datetime(2026, 1, 1, 12, 0, 0)
    factory = session_factory()

    with factory() as db:
        active_store = Store(name="Active", created_at=now, updated_at=now)
        other_store = Store(name="Other", created_at=now, updated_at=now)
        db.add_all([active_store, other_store])
        db.flush()

        active_post = Post(store_id=active_store.id, title="Active post", created_at=now, updated_at=now)
        other_post = Post(store_id=other_store.id, title="Other post", created_at=now, updated_at=now)
        active_asset = MediaAsset(
            store_id=active_store.id,
            original_filename="active.jpg",
            stored_filename="active.jpg",
            file_path="/tmp/active.jpg",
            content_type="image/jpeg",
            size_bytes=10,
            created_at=now,
        )
        other_asset = MediaAsset(
            store_id=other_store.id,
            original_filename="other.jpg",
            stored_filename="other.jpg",
            file_path="/tmp/other.jpg",
            content_type="image/jpeg",
            size_bytes=10,
            created_at=now,
        )
        db.add_all([active_post, other_post, active_asset, other_asset])
        db.commit()

        assert get_store_post(db, active_store, active_post.id).id == active_post.id
        assert get_store_media_asset(db, active_store, active_asset.id).id == active_asset.id

        with pytest.raises(HTTPException) as post_exc:
            get_store_post(db, active_store, other_post.id)
        with pytest.raises(HTTPException) as asset_exc:
            get_store_media_asset(db, active_store, other_asset.id)

        assert post_exc.value.status_code == 404
        assert post_exc.value.detail == "Post not found"
        assert asset_exc.value.status_code == 404
        assert asset_exc.value.detail == "Media not found"
