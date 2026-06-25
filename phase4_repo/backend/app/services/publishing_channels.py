from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import InstagramAccount, RubikaAccount
from app.services.rubika_health import is_rubika_account_ready

CHANNELS = ("rubika", "instagram")
DEFAULT_CHANNEL = "rubika"
INSTAGRAM_OAUTH_REQUIRED_DETAIL = "Instagram direct publishing requires Meta OAuth; personal accounts can use reminder mode"


def is_instagram_reminder_ready(account: InstagramAccount | None) -> bool:
    return bool(account and account.is_active and account.publish_mode == "reminder")


def normalize_channels(value: str | None) -> str:
    raw_channels = [part.strip().lower() for part in (value or DEFAULT_CHANNEL).replace("|", ",").split(",")]
    channels = list(dict.fromkeys(channel for channel in raw_channels if channel))
    if not channels:
        channels = [DEFAULT_CHANNEL]

    invalid = [channel for channel in channels if channel not in CHANNELS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unsupported publishing channel: {invalid[0]}")

    return ",".join(channels)


def channel_list(value: str | None) -> list[str]:
    return normalize_channels(value).split(",")


def get_active_rubika_account(db: Session) -> RubikaAccount | None:
    return db.scalar(select(RubikaAccount).where(RubikaAccount.is_active.is_(True)).order_by(RubikaAccount.id.asc()))


def get_active_instagram_account(db: Session, store_id: int) -> InstagramAccount | None:
    return db.scalar(
        select(InstagramAccount)
        .where(InstagramAccount.store_id == store_id, InstagramAccount.is_active.is_(True))
        .order_by(InstagramAccount.id.asc())
    )


def require_channel_readiness(db: Session, store_id: int, platform: str | None) -> None:
    channels = channel_list(platform)
    ready_channels: list[str] = []

    if "rubika" in channels:
        if is_rubika_account_ready(get_active_rubika_account(db)):
            ready_channels.append("rubika")

    if "instagram" in channels:
        instagram = get_active_instagram_account(db, store_id)
        if is_instagram_reminder_ready(instagram) or (instagram is not None and instagram.status == "connected"):
            ready_channels.append("instagram")

    if not ready_channels:
        if "rubika" in channels:
            raise HTTPException(status_code=400, detail="Rubika connection must be tested successfully within the last 24 hours")
        raise HTTPException(status_code=400, detail=INSTAGRAM_OAUTH_REQUIRED_DETAIL)
