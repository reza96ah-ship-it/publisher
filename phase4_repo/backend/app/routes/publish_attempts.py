from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_active_store
from app.models import Post, PublishAttempt, Store
from app.schemas import PublishAttemptResponse

router = APIRouter(prefix="/publish-attempts", tags=["publish-attempts"])


def attempt_response(attempt: PublishAttempt, post_title: str, post_platform: str) -> PublishAttemptResponse:
    return PublishAttemptResponse(
        id=attempt.id,
        post_id=attempt.post_id,
        post_title=post_title,
        post_platform=post_platform,
        channel=attempt.channel,
        action=attempt.action,
        status=attempt.status,
        request_payload=attempt.request_payload,
        response_payload=attempt.response_payload,
        error=attempt.error,
        started_at=attempt.started_at,
        finished_at=attempt.finished_at,
        created_at=attempt.created_at,
    )


@router.get("", response_model=list[PublishAttemptResponse])
def list_publish_attempts(
    post_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    store: Store = Depends(get_active_store),
    db: Session = Depends(get_db),
) -> list[PublishAttemptResponse]:
    statement = select(PublishAttempt, Post.title, Post.platform).join(Post, Post.id == PublishAttempt.post_id).where(Post.store_id == store.id)
    if post_id is not None:
        statement = statement.where(PublishAttempt.post_id == post_id)
    if status and status != "all":
        statement = statement.where(PublishAttempt.status == status)
    rows = db.execute(statement.order_by(PublishAttempt.created_at.desc()).limit(100)).all()
    return [attempt_response(attempt, post_title, post_platform) for attempt, post_title, post_platform in rows]
