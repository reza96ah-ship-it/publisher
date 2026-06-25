from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_active_store
from app.models import Post, RubikaAccount, Store, InstagramAutomationEvent
from app.schemas import OperationalNotificationListResponse, OperationalNotificationResponse, OperationalNotificationSummaryResponse
from app.services.rubika_health import is_rubika_account_ready

router = APIRouter(prefix="/notifications", tags=["notifications"])


def get_active_rubika_account(db: Session) -> RubikaAccount | None:
    return db.scalar(select(RubikaAccount).where(RubikaAccount.is_active.is_(True)).order_by(RubikaAccount.id.asc()))


def rubika_notification(account: RubikaAccount | None, now: datetime) -> OperationalNotificationResponse | None:
    if is_rubika_account_ready(account, now):
        return None
    if account is None or not account.bot_token.strip() or not account.chat_id.strip():
        title = "اتصال روبیکا کامل نیست"
        description = "توکن و مقصد انتشار باید پیش از زمان‌بندی پست‌ها ذخیره و آزمایش شوند."
    elif account.status == "failed":
        title = "آزمایش اتصال روبیکا ناموفق بود"
        description = account.last_error or "آخرین آزمایش اتصال روبیکا با خطا پایان یافت."
    else:
        title = "آزمایش اتصال روبیکا منقضی شده"
        description = "برای باز شدن مسیر زمان‌بندی، اتصال روبیکا را دوباره آزمایش کنید."
    return OperationalNotificationResponse(
        id=f"rubika-readiness-{int(account.last_test_at.timestamp())}" if account and account.last_test_at else "rubika-readiness",
        category="connection",
        severity="critical",
        title=title,
        description=description,
        recovery_hint="تنظیمات اتصال را باز کنید، مقصد را بررسی کنید و آزمایش اتصال را دوباره اجرا کنید.",
        action_label="بررسی اتصال روبیکا",
        action_href="/rubika",
        created_at=account.last_test_at if account and account.last_test_at else now,
        action_required=True,
    )


def build_operational_notifications(db: Session, store: Store, now: datetime | None = None) -> OperationalNotificationListResponse:
    current_time = now or datetime.utcnow()
    notifications: list[OperationalNotificationResponse] = []
    connection_notification = rubika_notification(get_active_rubika_account(db), current_time)
    if connection_notification:
        notifications.append(connection_notification)

    # Fetch direct message takeover events
    takeover_events = db.scalars(
        select(InstagramAutomationEvent)
        .where(
            InstagramAutomationEvent.store_id == store.id,
            InstagramAutomationEvent.conversation_status == "waiting_operator"
        )
        .order_by(InstagramAutomationEvent.updated_at.desc())
    ).all()
    for ev in takeover_events:
        notifications.append(
            OperationalNotificationResponse(
                id=f"takeover-{ev.id}",
                category="instagram_takeover",
                severity="warning",
                title="در انتظار پاسخ اپراتور (اینستاگرام)",
                description=f"کاربر @{ev.commenter_username} به پیام خودکار پاسخ داد: «{ev.comment_text[:50]}...»",
                recovery_hint="برای ادامه گفتگو با کاربر، وارد بخش پیام‌ها شوید.",
                action_label="مشاهده گفتگو",
                action_href=f"/inbox?thread={ev.commenter_ig_scoped_id or ev.commenter_username}",
                post_id=ev.post_id,
                created_at=ev.updated_at,
                action_required=True,
            )
        )

    posts = db.scalars(select(Post).where(Post.store_id == store.id).order_by(Post.updated_at.desc(), Post.id.desc())).all()
    stale_cutoff = current_time - timedelta(minutes=15)
    recent_cutoff = current_time - timedelta(hours=24)

    for post in posts:
        if post.status == "failed":
            failed_at = post.failed_at or post.updated_at
            notifications.append(
                OperationalNotificationResponse(
                    id=f"post-failed-{post.id}-{int(failed_at.timestamp())}",
                    category="publishing",
                    severity="critical",
                    title=f"انتشار «{post.title}» ناموفق بود",
                    description=post.last_error or "انتشار پست با خطا پایان یافت و نیازمند بررسی است.",
                    recovery_hint="علت خطا را بررسی کنید و پس از اصلاح، پست را دوباره وارد صف انتشار کنید.",
                    action_label="باز کردن صف بازیابی",
                    action_href="/queue",
                    post_id=post.id,
                    created_at=failed_at,
                    action_required=True,
                )
            )
        elif post.status == "publishing" and post.updated_at <= stale_cutoff:
            notifications.append(
                OperationalNotificationResponse(
                    id=f"post-stale-{post.id}-{int(post.updated_at.timestamp())}",
                    category="worker",
                    severity="warning",
                    title=f"انتشار «{post.title}» بیش از حد طول کشیده است",
                    description="worker هنوز نتیجه نهایی این انتشار را ثبت نکرده است.",
                    recovery_hint="سلامت انتشار را بررسی کنید. worker تلاش‌های معلق را پس از ۱۵ دقیقه برای بازیابی علامت‌گذاری می‌کند.",
                    action_label="بررسی سلامت انتشار",
                    action_href="/logs",
                    post_id=post.id,
                    created_at=post.updated_at,
                    action_required=True,
                )
            )
        elif post.status == "manual_ready":
            notifications.append(
                OperationalNotificationResponse(
                    id=f"post-manual-ready-{post.id}-{int(post.updated_at.timestamp())}",
                    category="publishing",
                    severity="warning",
                    title=f"«{post.title}» آماده انتشار دستی است",
                    description="این پست برای اکانت معمولی اینستاگرام آماده شده و باید دستی در Instagram منتشر شود.",
                    recovery_hint="کپشن را کپی کنید، Instagram را باز کنید و بعد از انتشار، پست را به عنوان منتشرشده علامت بزنید.",
                    action_label="باز کردن صف انتشار",
                    action_href="/queue",
                    post_id=post.id,
                    created_at=post.updated_at,
                    action_required=True,
                )
            )
        elif post.status == "published" and post.published_at and post.published_at >= recent_cutoff:
            notifications.append(
                OperationalNotificationResponse(
                    id=f"post-published-{post.id}-{int(post.published_at.timestamp())}",
                    category="publishing",
                    severity="info",
                    title=f"«{post.title}» منتشر شد",
                    description="انتشار با موفقیت انجام شد و شناسه پیام روبیکا ذخیره شده است.",
                    recovery_hint="اقدامی لازم نیست. برای مرور جزئیات می‌توانید فهرست محتوای منتشرشده را باز کنید.",
                    action_label="مشاهده محتوای منتشرشده",
                    action_href="/content?status=published",
                    post_id=post.id,
                    created_at=post.published_at,
                    action_required=False,
                )
            )

    severity_order = {"critical": 0, "warning": 1, "info": 2}
    notifications.sort(key=lambda item: (severity_order.get(item.severity, 9), -item.created_at.timestamp()))
    summary = OperationalNotificationSummaryResponse(
        total=len(notifications),
        action_required=sum(item.action_required for item in notifications),
        critical=sum(item.severity == "critical" for item in notifications),
        warning=sum(item.severity == "warning" for item in notifications),
        info=sum(item.severity == "info" for item in notifications),
    )
    return OperationalNotificationListResponse(notifications=notifications, summary=summary)


@router.get("", response_model=OperationalNotificationListResponse)
def list_operational_notifications(store: Store = Depends(get_active_store), db: Session = Depends(get_db)) -> OperationalNotificationListResponse:
    return build_operational_notifications(db, store)
