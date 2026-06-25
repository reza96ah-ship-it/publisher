from datetime import datetime

from celery import Celery

from app.config import get_settings
from app.database import SessionLocal
from app.services.instagram_automation import process_instagram_automation_event as process_instagram_automation_event_service
from app.services.publisher import publish_post, recover_stale_publishing_posts, reserve_due_posts

settings = get_settings()

celery_app = Celery(
    "rubika_publisher_worker",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    timezone="Asia/Tehran",
    enable_utc=True,
    task_track_started=True,
    beat_schedule={
        "publish-due-posts-every-minute": {
            "task": "posts.publish_due",
            "schedule": 60.0,
        }
    },
)


@celery_app.task(name="system.ping")
def ping() -> str:
    return "pong"


@celery_app.task(name="posts.publish_due")
def publish_due_posts(limit: int = 10) -> dict:
    now = datetime.utcnow()
    results: list[dict] = []

    with SessionLocal() as db:
        recovered_count = recover_stale_publishing_posts(db, now)
        posts = reserve_due_posts(db, now, limit)

        for post in posts:
            try:
                results.append(publish_post(db, post, action="scheduled"))
            except Exception as exc:
                post.status = "failed"
                post.failed_at = datetime.utcnow()
                post.last_error = str(exc)
                post.updated_at = datetime.utcnow()
                db.commit()
                results.append({"ok": False, "post_id": post.id, "error": str(exc)})

    return {"checked_at": now.isoformat(), "recovered": recovered_count, "count": len(results), "results": results}


@celery_app.task(name="instagram.process_automation_event")
def process_instagram_automation_event(event_id: int) -> dict:
    with SessionLocal() as db:
        return process_instagram_automation_event_service(db, event_id)


@celery_app.task(name="instagram.send_direct_message")
def send_instagram_direct_message(page_id: str, access_token: str, recipient_id: str, text: str) -> dict:
    from app.services.instagram_client import InstagramGraphClient
    client = InstagramGraphClient()
    result = client.send_direct_message(page_id, access_token, recipient_id, text)
    return {"ok": result.ok, "message_id": result.message_id, "error": result.error}
