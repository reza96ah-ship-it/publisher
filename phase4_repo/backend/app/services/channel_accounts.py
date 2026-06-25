import json
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ChannelAccount, InstagramAccount, RubikaAccount, Store
from app.schemas import ChannelAccountResponse
from app.services.rubika_client import mask_token
from app.services.rubika_health import is_rubika_account_ready


def encode_list(values: list[str]) -> str:
    return json.dumps(values, ensure_ascii=False)


def decode_list(value: str) -> list[str]:
    try:
        decoded = json.loads(value or "[]")
    except json.JSONDecodeError:
        return []
    if not isinstance(decoded, list):
        return []
    return [str(item) for item in decoded]


def account_response(account: ChannelAccount) -> ChannelAccountResponse:
    return ChannelAccountResponse(
        id=account.id,
        store_id=account.store_id,
        channel=account.channel,
        display_name=account.display_name,
        external_account_id=account.external_account_id,
        mode=account.mode,
        status=account.status,
        capabilities=decode_list(account.capabilities),
        limitations=decode_list(account.limitations),
        last_error=account.last_error,
        last_test_at=account.last_test_at,
        is_active=account.is_active,
        created_at=account.created_at,
        updated_at=account.updated_at,
    )


def get_or_create_channel_account(db: Session, store_id: int, channel: str) -> ChannelAccount:
    account = db.scalar(
        select(ChannelAccount)
        .where(ChannelAccount.store_id == store_id, ChannelAccount.channel == channel, ChannelAccount.is_active.is_(True))
        .order_by(ChannelAccount.id.asc())
    )
    if account is None:
        account = ChannelAccount(store_id=store_id, channel=channel)
        db.add(account)
        db.flush()
    return account


def get_active_rubika_account(db: Session) -> RubikaAccount | None:
    return db.scalar(select(RubikaAccount).where(RubikaAccount.is_active.is_(True)).order_by(RubikaAccount.id.asc()))


def get_active_instagram_account(db: Session, store_id: int) -> InstagramAccount | None:
    return db.scalar(
        select(InstagramAccount)
        .where(InstagramAccount.store_id == store_id, InstagramAccount.is_active.is_(True))
        .order_by(InstagramAccount.id.asc())
    )


def sync_rubika_channel(db: Session, store: Store, now: datetime | None = None) -> ChannelAccount:
    rubika = get_active_rubika_account(db)
    channel = get_or_create_channel_account(db, store.id, "rubika")
    now = now or datetime.utcnow()

    if rubika is None or not rubika.bot_token.strip() or not rubika.chat_id.strip():
        status = "not_configured"
        mode = "disconnected"
        capabilities = ["setup_required"]
        limitations = ["Rubika bot token and destination are required before scheduling."]
        display_name = "روبیکا"
        external_account_id = ""
        last_error = rubika.last_error if rubika else ""
        last_test_at = rubika.last_test_at if rubika else None
    elif is_rubika_account_ready(rubika, now):
        status = "ready"
        mode = "rubika_bot"
        capabilities = ["schedule", "auto_publish", "text_post", "image_post", "publish_attempts", "retry"]
        limitations = ["Connection test must be renewed every 24 hours."]
        display_name = rubika.bot_name or "Rubika Bot"
        external_account_id = rubika.chat_id
        last_error = ""
        last_test_at = rubika.last_test_at
    elif rubika.status == "connected":
        status = "test_expired"
        mode = "rubika_bot"
        capabilities = ["text_post", "image_post", "publish_attempts"]
        limitations = ["A fresh successful connection test is required before scheduling."]
        display_name = rubika.bot_name or "Rubika Bot"
        external_account_id = rubika.chat_id
        last_error = rubika.last_error
        last_test_at = rubika.last_test_at
    else:
        status = rubika.status or "not_tested"
        mode = "rubika_bot"
        capabilities = ["text_post", "image_post"]
        limitations = ["Rubika must pass the connection test before auto-publishing."]
        display_name = rubika.bot_name or "روبیکا"
        external_account_id = rubika.chat_id
        last_error = rubika.last_error
        last_test_at = rubika.last_test_at

    channel.display_name = display_name
    channel.external_account_id = external_account_id
    channel.mode = mode
    channel.status = status
    channel.capabilities = encode_list(capabilities)
    channel.limitations = encode_list(limitations)
    channel.last_error = last_error
    channel.last_test_at = last_test_at
    channel.updated_at = now
    return channel


def sync_instagram_channel(db: Session, store: Store, now: datetime | None = None) -> ChannelAccount:
    instagram = get_active_instagram_account(db, store.id)
    channel = get_or_create_channel_account(db, store.id, "instagram")
    now = now or datetime.utcnow()

    if instagram is None:
        status = "not_configured"
        mode = "disconnected"
        capabilities = ["setup_required"]
        limitations = ["Choose a personal manual reminder account or connect a professional Meta account."]
        display_name = "اینستاگرام"
        external_account_id = ""
        last_error = ""
        last_test_at = None
    elif instagram.publish_mode == "reminder":
        status = "ready" if instagram.status == "reminder_ready" else instagram.status
        mode = "instagram_personal_manual"
        capabilities = ["schedule", "manual_publish", "image_post", "publish_attempts", "copy_caption"]
        limitations = ["Personal Instagram accounts require manual publishing; auto-publish is not available."]
        display_name = instagram.username or "Instagram personal"
        external_account_id = instagram.username
        last_error = instagram.last_error
        last_test_at = instagram.last_test_at
    elif instagram.status == "connected":
        status = "ready"
        mode = "instagram_professional_api"
        capabilities = ["schedule", "auto_publish", "image_post", "publish_attempts", "retry"]
        limitations = ["Meta permissions and token health must remain valid."]
        display_name = instagram.username or instagram.professional_account_id or "Instagram professional"
        external_account_id = instagram.professional_account_id or instagram.username
        last_error = instagram.last_error
        last_test_at = instagram.last_test_at
    else:
        status = instagram.status or "oauth_required"
        mode = "instagram_professional_api"
        capabilities = ["draft", "image_post"]
        limitations = ["Meta OAuth and content publishing permissions are required for direct publishing."]
        display_name = instagram.username or "Instagram professional"
        external_account_id = instagram.professional_account_id or instagram.username
        last_error = instagram.last_error
        last_test_at = instagram.last_test_at

    channel.display_name = display_name
    channel.external_account_id = external_account_id
    channel.mode = mode
    channel.status = status
    channel.capabilities = encode_list(capabilities)
    channel.limitations = encode_list(limitations)
    channel.last_error = last_error
    channel.last_test_at = last_test_at
    channel.updated_at = now
    return channel


def sync_channel_accounts(db: Session, store: Store, now: datetime | None = None) -> list[ChannelAccount]:
    now = now or datetime.utcnow()
    accounts = [
        sync_rubika_channel(db, store, now),
        sync_instagram_channel(db, store, now),
    ]
    db.commit()
    for account in accounts:
        db.refresh(account)
    return accounts


def masked_channel_reference(account: ChannelAccount) -> str:
    if account.channel == "rubika":
        return mask_token(account.external_account_id)
    return account.external_account_id
