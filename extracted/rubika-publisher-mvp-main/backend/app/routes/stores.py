from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Store, User
from app.schemas import StoreResponse, StoreUpsertRequest

router = APIRouter(prefix="/stores", tags=["stores"])


def make_response(store: Store) -> StoreResponse:
    return StoreResponse(
        id=store.id,
        name=store.name,
        category=store.category,
        phone=store.phone,
        description=store.description,
        default_hashtags=store.default_hashtags,
        caption_footer=store.caption_footer,
        timezone=store.timezone,
        is_active=store.is_active,
    )


@router.get("/active")
def get_active_store(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    store = db.scalar(select(Store).where(Store.is_active.is_(True)).order_by(Store.id.asc()))
    if store is None:
        return None
    return make_response(store)


@router.put("/active")
def save_active_store(payload: StoreUpsertRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    store = db.scalar(select(Store).where(Store.is_active.is_(True)).order_by(Store.id.asc()))
    if store is None:
        store = Store(name=payload.name.strip() or "فروشگاه من")
        db.add(store)

    store.name = payload.name.strip() or "فروشگاه من"
    store.category = payload.category.strip()
    store.phone = payload.phone.strip()
    store.description = payload.description.strip()
    store.default_hashtags = payload.default_hashtags.strip()
    store.caption_footer = payload.caption_footer.strip()
    store.timezone = payload.timezone.strip() or "Asia/Tehran"
    store.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(store)
    return make_response(store)
