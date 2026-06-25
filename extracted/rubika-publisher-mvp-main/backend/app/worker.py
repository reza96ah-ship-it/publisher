from celery import Celery

from app.config import get_settings

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
)


@celery_app.task(name="system.ping")
def ping() -> str:
    return "pong"
