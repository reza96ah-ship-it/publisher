from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, default="Admin")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    logo_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avatar_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    brand_primary_color: Mapped[str] = mapped_column(String(32), nullable=False, default="#0F766E")
    brand_accent_color: Mapped[str] = mapped_column(String(32), nullable=False, default="#2563EB")
    brand_voice: Mapped[str] = mapped_column(Text, nullable=False, default="")
    default_cta: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content_guidelines: Mapped[str] = mapped_column(Text, nullable=False, default="")
    default_hashtags: Mapped[str] = mapped_column(Text, nullable=False, default="")
    caption_footer: Mapped[str] = mapped_column(Text, nullable=False, default="")
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Tehran")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class RubikaAccount(Base):
    __tablename__ = "rubika_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    bot_token: Mapped[str] = mapped_column(Text, nullable=False, default="")
    chat_id: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    bot_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="not_tested")
    last_error: Mapped[str] = mapped_column(Text, nullable=False, default="")
    last_test_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class InstagramAccount(Base):
    __tablename__ = "instagram_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    account_type: Mapped[str] = mapped_column(String(64), nullable=False, default="creator")
    publish_mode: Mapped[str] = mapped_column(String(64), nullable=False, default="direct")
    professional_account_id: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    page_id: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    access_token: Mapped[str] = mapped_column(Text, nullable=False, default="")
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="oauth_required", index=True)
    permissions: Mapped[str] = mapped_column(Text, nullable=False, default="")
    last_error: Mapped[str] = mapped_column(Text, nullable=False, default="")
    last_test_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class ChannelAccount(Base):
    __tablename__ = "channel_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    external_account_id: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    mode: Mapped[str] = mapped_column(String(64), nullable=False, default="disconnected")
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="not_configured", index=True)
    capabilities: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    limitations: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    last_error: Mapped[str] = mapped_column(Text, nullable=False, default="")
    last_test_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    goal: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="active", index=True)
    color: Mapped[str] = mapped_column(String(32), nullable=False, default="#0F766E")
    owner: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    starts_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    caption: Mapped[str] = mapped_column(Text, nullable=False, default="")
    hashtags: Mapped[str] = mapped_column(Text, nullable=False, default="")
    platform: Mapped[str] = mapped_column(String(64), nullable=False, default="rubika")
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="draft", index=True)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Tehran")
    campaign_id: Mapped[int | None] = mapped_column(ForeignKey("campaigns.id"), nullable=True, index=True)
    campaign: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    internal_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    ready_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    approval_status: Mapped[str] = mapped_column(String(64), nullable=False, default="not_required", index=True)
    approval_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    rubika_message_id: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    last_error: Mapped[str] = mapped_column(Text, nullable=False, default="")
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    post_id: Mapped[int | None] = mapped_column(ForeignKey("posts.id"), nullable=True, index=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    folder: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    tags: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class PublishAttempt(Base):
    __tablename__ = "publish_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(64), nullable=False, default="rubika", index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, default="manual")
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="created", index=True)
    request_payload: Mapped[str] = mapped_column(Text, nullable=False, default="")
    response_payload: Mapped[str] = mapped_column(Text, nullable=False, default="")
    error: Mapped[str] = mapped_column(Text, nullable=False, default="")
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class InstagramAutomationRule(Base):
    __tablename__ = "instagram_automation_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    instagram_account_id: Mapped[int | None] = mapped_column(ForeignKey("instagram_accounts.id"), nullable=True, index=True)
    campaign_id: Mapped[int | None] = mapped_column(ForeignKey("campaigns.id"), nullable=True, index=True)
    post_id: Mapped[int | None] = mapped_column(ForeignKey("posts.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="draft", index=True)
    trigger_type: Mapped[str] = mapped_column(String(64), nullable=False, default="exact")
    trigger_keywords: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    normalized_keywords: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    private_reply_message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    public_reply_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    public_reply_message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    match_limit_per_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    match_limit_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    is_template: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    on_customer_reply: Mapped[str] = mapped_column(String(64), nullable=False, default="hand_off")
    waiting_reply_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class InstagramAutomationEvent(Base):
    __tablename__ = "instagram_automation_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    rule_id: Mapped[int | None] = mapped_column(ForeignKey("instagram_automation_rules.id"), nullable=True, index=True)
    instagram_account_id: Mapped[int | None] = mapped_column(ForeignKey("instagram_accounts.id"), nullable=True, index=True)
    post_id: Mapped[int | None] = mapped_column(ForeignKey("posts.id"), nullable=True, index=True)
    ig_media_id: Mapped[str] = mapped_column(String(255), nullable=False, default="", index=True)
    ig_comment_id: Mapped[str] = mapped_column(String(255), nullable=False, default="", index=True)
    commenter_username: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    commenter_ig_scoped_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    comment_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    normalized_comment_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    event_status: Mapped[str] = mapped_column(String(64), nullable=False, default="received", index=True)
    conversation_status: Mapped[str | None] = mapped_column(String(64), default="automated", nullable=True)
    automation_paused_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    skip_reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    failure_reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    private_reply_message_id: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    public_reply_comment_id: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    webhook_payload: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    assigned_to: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    internal_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class SavedReply(Base):
    __tablename__ = "saved_replies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
