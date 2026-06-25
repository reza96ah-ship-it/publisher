from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.dependencies import get_active_store
from app.models import Campaign, Post, Store, User
from app.schemas import BulkPostCampaignRequest, BulkPostStatusRequest, BulkPostStatusResponse, PostRequest, PostResponse, PostReviewRequest, PostScheduleRequest, PostStatsResponse, PostStatusRequest, RetryFailedPostsResponse
from app.services.publishing_channels import normalize_channels, require_channel_readiness
from app.store_scope import get_store_post

router = APIRouter(prefix="/posts", tags=["posts"])

WORKFLOW_STATUSES = {"draft", "ready", "scheduled", "publishing", "published", "partially_published", "manual_ready", "failed", "cancelled"}
EDITABLE_STATUSES = {"draft", "ready", "scheduled", "failed"}
APPROVAL_STATUSES = {"not_required", "pending", "approved", "rejected", "changes_requested"}
PUBLISHABLE_APPROVAL_STATUSES = {"not_required", "approved"}


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


def post_response(post: Post) -> PostResponse:
    return PostResponse(
        id=post.id,
        store_id=post.store_id,
        title=post.title,
        caption=post.caption,
        hashtags=post.hashtags,
        platform=post.platform,
        status=post.status,
        timezone=post.timezone,
        campaign_id=post.campaign_id,
        campaign=post.campaign,
        internal_note=post.internal_note,
        scheduled_at=utc_response(post.scheduled_at),
        ready_at=utc_response(post.ready_at),
        published_at=utc_response(post.published_at),
        failed_at=utc_response(post.failed_at),
        approval_status=post.approval_status or "not_required",
        approval_note=post.approval_note or "",
        submitted_at=utc_response(post.submitted_at),
        reviewed_at=utc_response(post.reviewed_at),
        reviewed_by=post.reviewed_by or "",
        rubika_message_id=post.rubika_message_id,
        last_error=post.last_error,
        attempt_count=post.attempt_count,
        created_at=utc_response(post.created_at),
        updated_at=utc_response(post.updated_at),
    )


def validate_payload_campaign(db: Session, store: Store, campaign_id: int | None) -> Campaign | None:
    if campaign_id is None:
        return None
    campaign = db.scalar(select(Campaign).where(Campaign.id == campaign_id, Campaign.store_id == store.id))
    if campaign is None:
        raise HTTPException(status_code=400, detail="Campaign not found for active store")
    return campaign


def apply_payload(post: Post, payload: PostRequest, campaign: Campaign | None = None) -> None:
    post.title = payload.title.strip() or "پست بدون عنوان"
    post.caption = payload.caption.strip()
    post.hashtags = payload.hashtags.strip()
    post.platform = normalize_channels(payload.platform)
    post.timezone = payload.timezone.strip() or "Asia/Tehran"
    post.campaign_id = campaign.id if campaign else None
    post.campaign = campaign.name if campaign else payload.campaign.strip()
    post.internal_note = payload.internal_note.strip()
    post.scheduled_at = utc_naive(payload.scheduled_at)
    post.updated_at = datetime.utcnow()


def require_approval_ready(post: Post) -> None:
    if post.approval_status not in PUBLISHABLE_APPROVAL_STATUSES:
        raise HTTPException(status_code=400, detail="Post must be approved before scheduling")


def reviewer_label(user: User) -> str:
    return user.full_name or user.email


def requeue_failed_post(post: Post, now: datetime) -> None:
    post.status = "scheduled"
    post.scheduled_at = now
    post.ready_at = post.ready_at or now
    post.failed_at = None
    post.last_error = ""
    post.updated_at = now


def apply_review_decision(post: Post, status: str, note: str, reviewer: User | None, now: datetime) -> None:
    post.approval_status = status
    post.approval_note = note.strip()
    post.reviewed_at = now if status != "pending" else None
    post.reviewed_by = reviewer_label(reviewer) if reviewer and status != "pending" else ""
    post.updated_at = now
    if status == "pending":
        post.submitted_at = now
        post.reviewed_at = None
        post.reviewed_by = ""
        if post.status in {"draft", "failed", "cancelled"}:
            post.status = "ready"
            post.ready_at = post.ready_at or now
    if status in {"rejected", "changes_requested"} and post.status in {"ready", "scheduled"}:
        post.status = "draft"
        post.scheduled_at = None


def apply_workflow_status(post: Post, status: str, now: datetime) -> None:
    post.status = status
    post.updated_at = now
    if status == "ready":
        post.ready_at = post.ready_at or now
        post.last_error = ""
    if status == "cancelled":
        post.scheduled_at = None


@router.get("/stats", response_model=PostStatsResponse)
def post_stats(store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> PostStatsResponse:
    rows = db.execute(select(Post.status, func.count(Post.id)).where(Post.store_id == store.id).group_by(Post.status)).all()
    counts = {status: 0 for status in WORKFLOW_STATUSES}
    for status, count in rows:
        counts[status] = count
    return PostStatsResponse(total=sum(counts.values()), **counts)


@router.get("")
def list_posts(
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    campaign_id: int | None = Query(default=None),
    store: Store = Depends(get_active_store),
    db: Session = Depends(get_db),
):
    statement = select(Post).where(Post.store_id == store.id)
    if status and status != "all":
        statement = statement.where(Post.status == status)
    if search:
        pattern = f"%{search.strip()}%"
        statement = statement.where(Post.title.ilike(pattern) | Post.caption.ilike(pattern) | Post.hashtags.ilike(pattern))
    if campaign_id is not None:
        statement = statement.where(Post.campaign_id == campaign_id)
    posts = db.scalars(statement.order_by(Post.scheduled_at.asc().nulls_last(), Post.id.desc())).all()
    return [post_response(post) for post in posts]


@router.post("/retry-failed", response_model=RetryFailedPostsResponse)
def retry_all_failed_posts(store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> RetryFailedPostsResponse:
    posts = db.scalars(select(Post).where(Post.store_id == store.id, Post.status == "failed").order_by(Post.failed_at.asc(), Post.id.asc())).all()
    if not posts:
        return RetryFailedPostsResponse(retried_count=0, post_ids=[])
    now = datetime.utcnow()
    for post in posts:
        require_approval_ready(post)
        require_channel_readiness(db, store.id, post.platform)
        requeue_failed_post(post, now)
    db.commit()
    return RetryFailedPostsResponse(retried_count=len(posts), post_ids=[post.id for post in posts])


@router.post("/bulk-status", response_model=BulkPostStatusResponse)
def bulk_change_status(payload: BulkPostStatusRequest, store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> BulkPostStatusResponse:
    if payload.status not in {"ready", "cancelled"}:
        raise HTTPException(status_code=400, detail="Bulk status only supports ready or cancelled")
    unique_post_ids = list(dict.fromkeys(payload.post_ids))
    posts = db.scalars(select(Post).where(Post.store_id == store.id, Post.id.in_(unique_post_ids))).all() if unique_post_ids else []
    posts_by_id = {post.id: post for post in posts}
    eligible_statuses = {"draft", "failed", "cancelled"} if payload.status == "ready" else {"draft", "ready", "scheduled", "failed"}
    updated_ids: list[int] = []
    skipped_ids: list[int] = []
    now = datetime.utcnow()
    for post_id in unique_post_ids:
        post = posts_by_id.get(post_id)
        if post is None or post.status not in eligible_statuses:
            skipped_ids.append(post_id)
            continue
        apply_workflow_status(post, payload.status, now)
        updated_ids.append(post.id)
    db.commit()
    return BulkPostStatusResponse(updated_count=len(updated_ids), post_ids=updated_ids, skipped_post_ids=skipped_ids)


@router.post("/bulk-campaign", response_model=BulkPostStatusResponse)
def bulk_assign_campaign(payload: BulkPostCampaignRequest, store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> BulkPostStatusResponse:
    campaign = validate_payload_campaign(db, store, payload.campaign_id)
    unique_post_ids = list(dict.fromkeys(payload.post_ids))
    posts = db.scalars(select(Post).where(Post.store_id == store.id, Post.id.in_(unique_post_ids))).all() if unique_post_ids else []
    posts_by_id = {post.id: post for post in posts}
    updated_ids: list[int] = []
    skipped_ids: list[int] = []
    now = datetime.utcnow()
    for post_id in unique_post_ids:
        post = posts_by_id.get(post_id)
        if post is None:
            skipped_ids.append(post_id)
            continue
        post.campaign_id = campaign.id if campaign else None
        post.campaign = campaign.name if campaign else ""
        post.updated_at = now
        updated_ids.append(post.id)
    db.commit()
    return BulkPostStatusResponse(updated_count=len(updated_ids), post_ids=updated_ids, skipped_post_ids=skipped_ids)


@router.get("/{post_id}", response_model=PostResponse)
def read_post(post_id: int, store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> PostResponse:
    return post_response(get_store_post(db, store, post_id))


@router.post("", response_model=PostResponse)
def create_post(payload: PostRequest, store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> PostResponse:
    post = Post(store_id=store.id, status="draft")
    campaign = validate_payload_campaign(db, store, payload.campaign_id)
    apply_payload(post, payload, campaign)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post_response(post)


@router.put("/{post_id}", response_model=PostResponse)
def update_post(post_id: int, payload: PostRequest, store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> PostResponse:
    post = get_store_post(db, store, post_id)
    if post.status not in EDITABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Post cannot be edited in its current status")
    campaign = validate_payload_campaign(db, store, payload.campaign_id)
    apply_payload(post, payload, campaign)
    db.commit()
    db.refresh(post)
    return post_response(post)


@router.post("/{post_id}/ready", response_model=PostResponse)
def mark_ready(post_id: int, store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> PostResponse:
    post = get_store_post(db, store, post_id)
    if post.status not in {"draft", "failed", "cancelled"}:
        raise HTTPException(status_code=400, detail="Only draft, failed, or cancelled posts can be marked ready")
    post.status = "ready"
    post.ready_at = datetime.utcnow()
    post.last_error = ""
    post.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(post)
    return post_response(post)


@router.post("/{post_id}/schedule", response_model=PostResponse)
def schedule_post(post_id: int, payload: PostScheduleRequest, store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> PostResponse:
    post = get_store_post(db, store, post_id)
    if post.status not in {"draft", "ready", "scheduled", "failed"}:
        raise HTTPException(status_code=400, detail="Post cannot be scheduled in its current status")
    require_approval_ready(post)
    require_channel_readiness(db, store.id, post.platform)
    post.status = "scheduled"
    post.scheduled_at = utc_naive(payload.scheduled_at)
    post.timezone = payload.timezone.strip() or "Asia/Tehran"
    post.ready_at = post.ready_at or datetime.utcnow()
    post.last_error = ""
    post.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(post)
    return post_response(post)


@router.post("/{post_id}/manual-published", response_model=PostResponse)
def mark_manual_published(post_id: int, store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> PostResponse:
    post = get_store_post(db, store, post_id)
    if post.status != "manual_ready":
        raise HTTPException(status_code=400, detail="Only manual-ready posts can be marked as manually published")
    now = datetime.utcnow()
    post.status = "published"
    post.published_at = now
    post.failed_at = None
    post.last_error = ""
    post.updated_at = now
    db.commit()
    db.refresh(post)
    return post_response(post)


@router.post("/{post_id}/retry", response_model=PostResponse)
def retry_failed_post(post_id: int, store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> PostResponse:
    post = get_store_post(db, store, post_id)
    if post.status != "failed":
        raise HTTPException(status_code=400, detail="Only failed posts can be retried")
    require_approval_ready(post)
    require_channel_readiness(db, store.id, post.platform)
    now = datetime.utcnow()
    requeue_failed_post(post, now)
    db.commit()
    db.refresh(post)
    return post_response(post)


@router.post("/{post_id}/status", response_model=PostResponse)
def change_status(post_id: int, payload: PostStatusRequest, store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> PostResponse:
    if payload.status not in WORKFLOW_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid post status")
    post = get_store_post(db, store, post_id)
    if payload.status == "scheduled":
        require_approval_ready(post)
        require_channel_readiness(db, store.id, post.platform)
    apply_workflow_status(post, payload.status, datetime.utcnow())
    db.commit()
    db.refresh(post)
    return post_response(post)


@router.post("/{post_id}/submit-review", response_model=PostResponse)
def submit_post_for_review(post_id: int, payload: PostReviewRequest, store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> PostResponse:
    post = get_store_post(db, store, post_id)
    if post.status not in {"draft", "ready", "failed", "cancelled"}:
        raise HTTPException(status_code=400, detail="Post cannot be submitted for review in its current status")
    apply_review_decision(post, "pending", payload.note, None, datetime.utcnow())
    db.commit()
    db.refresh(post)
    return post_response(post)


@router.post("/{post_id}/approve", response_model=PostResponse)
def approve_post(post_id: int, payload: PostReviewRequest, store: Store = Depends(get_active_store), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> PostResponse:
    post = get_store_post(db, store, post_id)
    if post.approval_status != "pending":
        raise HTTPException(status_code=400, detail="Only pending posts can be approved")
    apply_review_decision(post, "approved", payload.note, current_user, datetime.utcnow())
    db.commit()
    db.refresh(post)
    return post_response(post)


@router.post("/{post_id}/reject", response_model=PostResponse)
def reject_post(post_id: int, payload: PostReviewRequest, store: Store = Depends(get_active_store), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> PostResponse:
    post = get_store_post(db, store, post_id)
    if post.approval_status != "pending":
        raise HTTPException(status_code=400, detail="Only pending posts can be rejected")
    apply_review_decision(post, "rejected", payload.note, current_user, datetime.utcnow())
    db.commit()
    db.refresh(post)
    return post_response(post)


@router.post("/{post_id}/request-changes", response_model=PostResponse)
def request_post_changes(post_id: int, payload: PostReviewRequest, store: Store = Depends(get_active_store), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> PostResponse:
    post = get_store_post(db, store, post_id)
    if post.approval_status != "pending":
        raise HTTPException(status_code=400, detail="Only pending posts can receive change requests")
    apply_review_decision(post, "changes_requested", payload.note, current_user, datetime.utcnow())
    db.commit()
    db.refresh(post)
    return post_response(post)
