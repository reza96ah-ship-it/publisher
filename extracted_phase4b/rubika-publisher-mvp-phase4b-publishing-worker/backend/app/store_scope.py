from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import MediaAsset, Post, Store


def find_active_store(db: Session) -> Store | None:
    return db.scalar(select(Store).where(Store.is_active.is_(True)).order_by(Store.id.asc()))


def require_active_store(db: Session) -> Store:
    store = find_active_store(db)
    if store is None:
        raise HTTPException(status_code=400, detail="Create store profile first")
    return store


def get_store_post(db: Session, store: Store, post_id: int) -> Post:
    post = db.scalar(select(Post).where(Post.id == post_id, Post.store_id == store.id))
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


def get_store_media_asset(db: Session, store: Store, asset_id: int) -> MediaAsset:
    asset = db.scalar(select(MediaAsset).where(MediaAsset.id == asset_id, MediaAsset.store_id == store.id))
    if asset is None:
        raise HTTPException(status_code=404, detail="Media not found")
    return asset
