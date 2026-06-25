from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import MediaAsset, Store, User
from app.schemas import StoreResponse, StoreUpsertRequest
from app.store_scope import find_active_store

router = APIRouter(prefix="/stores", tags=["stores"])


def normalize_color(value: str, fallback: str) -> str:
    value = value.strip()
    if len(value) == 7 and value.startswith("#") and all(char in "0123456789abcdefABCDEF" for char in value[1:]):
        return value.upper()
    return fallback


def validate_brand_asset(db: Session, store: Store, asset_id: int | None) -> int | None:
    if asset_id is None:
        return None
    asset = db.scalar(select(MediaAsset).where(MediaAsset.id == asset_id, MediaAsset.store_id == store.id))
    if asset is None or not asset.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Brand asset must be an image from the active store")
    return asset.id


def make_response(store: Store) -> StoreResponse:
    return StoreResponse(
        id=store.id,
        name=store.name,
        category=store.category,
        phone=store.phone,
        description=store.description,
        logo_asset_id=store.logo_asset_id,
        avatar_asset_id=store.avatar_asset_id,
        brand_primary_color=store.brand_primary_color,
        brand_accent_color=store.brand_accent_color,
        brand_voice=store.brand_voice,
        default_cta=store.default_cta,
        content_guidelines=store.content_guidelines,
        default_hashtags=store.default_hashtags,
        caption_footer=store.caption_footer,
        timezone=store.timezone,
        is_active=store.is_active,
    )


@router.get("/active")
def read_active_store(_current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    store = find_active_store(db)
    if store is None:
        return None
    return make_response(store)


@router.put("/active")
def save_active_store(payload: StoreUpsertRequest, _current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    store = find_active_store(db)
    if store is None:
        store = Store(name=payload.name.strip() or "فروشگاه من")
        db.add(store)

    store.name = payload.name.strip() or "فروشگاه من"
    store.category = payload.category.strip()
    store.phone = payload.phone.strip()
    store.description = payload.description.strip()
    store.logo_asset_id = validate_brand_asset(db, store, payload.logo_asset_id)
    store.avatar_asset_id = validate_brand_asset(db, store, payload.avatar_asset_id)
    store.brand_primary_color = normalize_color(payload.brand_primary_color, "#0F766E")
    store.brand_accent_color = normalize_color(payload.brand_accent_color, "#2563EB")
    store.brand_voice = payload.brand_voice.strip()
    store.default_cta = payload.default_cta.strip()
    store.content_guidelines = payload.content_guidelines.strip()
    store.default_hashtags = payload.default_hashtags.strip()
    store.caption_footer = payload.caption_footer.strip()
    store.timezone = payload.timezone.strip() or "Asia/Tehran"
    store.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(store)
    return make_response(store)
