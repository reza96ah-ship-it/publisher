from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models import MediaAsset, Post, Store, User
from app.schemas import AttachMediaRequest, MediaResponse

router = APIRouter(prefix="/media", tags=["media"])
settings = get_settings()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 8 * 1024 * 1024


def active_store(db: Session) -> Store:
    store = db.scalar(select(Store).where(Store.is_active.is_(True)).order_by(Store.id.asc()))
    if store is None:
        raise HTTPException(status_code=400, detail="Create store profile first")
    return store


def media_response(asset: MediaAsset) -> MediaResponse:
    return MediaResponse(
        id=asset.id,
        store_id=asset.store_id,
        post_id=asset.post_id,
        original_filename=asset.original_filename,
        stored_filename=asset.stored_filename,
        content_type=asset.content_type,
        size_bytes=asset.size_bytes,
        url=f"/media/{asset.id}/file",
    )


@router.get("")
def list_media(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    store = active_store(db)
    assets = db.scalars(select(MediaAsset).where(MediaAsset.store_id == store.id).order_by(MediaAsset.id.desc())).all()
    return [media_response(asset) for asset in assets]


@router.post("")
async def upload_media(file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    store = active_store(db)
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG and WEBP images are allowed")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File is too large")

    media_dir = Path(settings.media_dir)
    media_dir.mkdir(parents=True, exist_ok=True)

    extension = Path(file.filename or "image").suffix.lower() or ".jpg"
    stored_filename = f"{uuid4().hex}{extension}"
    file_path = media_dir / stored_filename
    file_path.write_bytes(content)

    asset = MediaAsset(
        store_id=store.id,
        original_filename=file.filename or stored_filename,
        stored_filename=stored_filename,
        file_path=str(file_path),
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return media_response(asset)


@router.get("/{asset_id}/file")
def read_media_file(asset_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    store = active_store(db)
    asset = db.scalar(select(MediaAsset).where(MediaAsset.id == asset_id, MediaAsset.store_id == store.id))
    if asset is None:
        raise HTTPException(status_code=404, detail="Media not found")
    return FileResponse(asset.file_path, media_type=asset.content_type, filename=asset.original_filename)


@router.put("/{asset_id}/attach")
def attach_media(asset_id: int, payload: AttachMediaRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    store = active_store(db)
    asset = db.scalar(select(MediaAsset).where(MediaAsset.id == asset_id, MediaAsset.store_id == store.id))
    if asset is None:
        raise HTTPException(status_code=404, detail="Media not found")

    if payload.post_id is not None:
        post = db.scalar(select(Post).where(Post.id == payload.post_id, Post.store_id == store.id))
        if post is None:
            raise HTTPException(status_code=404, detail="Post not found")

    asset.post_id = payload.post_id
    db.commit()
    db.refresh(asset)
    return media_response(asset)
