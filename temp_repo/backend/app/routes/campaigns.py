from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_active_store
from app.models import Campaign, Post, Store
from app.schemas import CampaignRequest, CampaignResponse

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

CAMPAIGN_STATUSES = {"active", "paused", "completed", "archived"}


def utc_naive(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def utc_response(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def normalize_color(value: str, fallback: str = "#0F766E") -> str:
    value = value.strip()
    if len(value) == 7 and value.startswith("#") and all(char in "0123456789abcdefABCDEF" for char in value[1:]):
        return value.upper()
    return fallback


def get_store_campaign(db: Session, store: Store, campaign_id: int) -> Campaign:
    campaign = db.scalar(select(Campaign).where(Campaign.id == campaign_id, Campaign.store_id == store.id))
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


def campaign_response(campaign: Campaign, post_count: int = 0) -> CampaignResponse:
    return CampaignResponse(
        id=campaign.id,
        store_id=campaign.store_id,
        name=campaign.name,
        goal=campaign.goal,
        status=campaign.status,
        color=campaign.color,
        owner=campaign.owner,
        starts_at=utc_response(campaign.starts_at),
        ends_at=utc_response(campaign.ends_at),
        notes=campaign.notes,
        post_count=post_count,
        created_at=utc_response(campaign.created_at),
        updated_at=utc_response(campaign.updated_at),
    )


def apply_campaign_payload(campaign: Campaign, payload: CampaignRequest) -> None:
    campaign.name = payload.name.strip() or "کمپین بدون نام"
    campaign.goal = payload.goal.strip()
    campaign.status = payload.status.strip() if payload.status.strip() in CAMPAIGN_STATUSES else "active"
    campaign.color = normalize_color(payload.color)
    campaign.owner = payload.owner.strip()
    campaign.starts_at = utc_naive(payload.starts_at)
    campaign.ends_at = utc_naive(payload.ends_at)
    campaign.notes = payload.notes.strip()
    campaign.updated_at = datetime.utcnow()


@router.get("", response_model=list[CampaignResponse])
def list_campaigns(
    status: str | None = Query(default=None),
    store: Store = Depends(get_active_store),
    db: Session = Depends(get_db),
) -> list[CampaignResponse]:
    counts_subquery = select(Post.campaign_id, func.count(Post.id).label("post_count")).where(Post.store_id == store.id, Post.campaign_id.is_not(None)).group_by(Post.campaign_id).subquery()
    statement = select(Campaign, func.coalesce(counts_subquery.c.post_count, 0)).outerjoin(counts_subquery, counts_subquery.c.campaign_id == Campaign.id).where(Campaign.store_id == store.id)
    if status and status != "all":
        statement = statement.where(Campaign.status == status)
    rows = db.execute(statement.order_by(Campaign.updated_at.desc(), Campaign.id.desc())).all()
    return [campaign_response(campaign, post_count) for campaign, post_count in rows]


@router.post("", response_model=CampaignResponse)
def create_campaign(payload: CampaignRequest, store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> CampaignResponse:
    campaign = Campaign(store_id=store.id, created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    apply_campaign_payload(campaign, payload)
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign_response(campaign)


@router.get("/{campaign_id}", response_model=CampaignResponse)
def read_campaign(campaign_id: int, store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> CampaignResponse:
    campaign = get_store_campaign(db, store, campaign_id)
    post_count = db.scalar(select(func.count(Post.id)).where(Post.store_id == store.id, Post.campaign_id == campaign.id)) or 0
    return campaign_response(campaign, post_count)


@router.put("/{campaign_id}", response_model=CampaignResponse)
def update_campaign(campaign_id: int, payload: CampaignRequest, store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> CampaignResponse:
    campaign = get_store_campaign(db, store, campaign_id)
    apply_campaign_payload(campaign, payload)
    db.commit()
    db.refresh(campaign)
    post_count = db.scalar(select(func.count(Post.id)).where(Post.store_id == store.id, Post.campaign_id == campaign.id)) or 0
    return campaign_response(campaign, post_count)


@router.delete("/{campaign_id}", response_model=CampaignResponse)
def delete_campaign(campaign_id: int, store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> CampaignResponse:
    campaign = get_store_campaign(db, store, campaign_id)
    post_count = db.scalar(select(func.count(Post.id)).where(Post.store_id == store.id, Post.campaign_id == campaign.id)) or 0
    if post_count:
        raise HTTPException(status_code=400, detail="Campaign has posts and cannot be deleted")
    response = campaign_response(campaign, post_count)
    db.delete(campaign)
    db.commit()
    return response
