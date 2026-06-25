import asyncio
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import MediaAsset, Post, PublishAttempt, RubikaAccount
from app.services.publishing_channels import channel_list, get_active_instagram_account, is_instagram_reminder_ready
from app.services.rubika_client import RubikaClient


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def build_post_text(post: Post) -> str:
    parts = [post.caption.strip(), post.hashtags.strip()]
    text = "\n\n".join([part for part in parts if part])
    return text or post.title.strip() or "پست بدون متن"


def rubika_file_type(asset: MediaAsset) -> str:
    if asset.content_type.startswith("image/"):
        return "Image"
    return "File"


def get_active_rubika_account(db: Session) -> RubikaAccount | None:
    return db.scalar(select(RubikaAccount).where(RubikaAccount.is_active.is_(True)).order_by(RubikaAccount.id.asc()))


def get_primary_media_asset(db: Session, post: Post) -> MediaAsset | None:
    return db.scalar(select(MediaAsset).where(MediaAsset.post_id == post.id, MediaAsset.store_id == post.store_id).order_by(MediaAsset.id.asc()))


def extract_message_id(payload: dict) -> str:
    data = payload.get("data") if isinstance(payload, dict) else None
    nested_send = payload.get("send") if isinstance(payload, dict) else None
    candidates = []
    if isinstance(data, dict):
        candidates.extend([data.get("message_id"), data.get("messageId"), data.get("id")])
    if isinstance(nested_send, dict):
        nested_data = nested_send.get("data") if isinstance(nested_send.get("data"), dict) else {}
        candidates.extend([nested_data.get("message_id"), nested_data.get("messageId"), nested_data.get("id")])
        candidates.extend([nested_send.get("message_id"), nested_send.get("messageId"), nested_send.get("id")])
    candidates.extend([payload.get("message_id"), payload.get("messageId"), payload.get("id")])
    for value in candidates:
        if value is not None:
            return str(value)
    return ""


def extract_upload_url(payload: dict) -> str:
    if not isinstance(payload, dict):
        return ""
    containers = [payload]
    for key in ["data", "result", "file"]:
        value = payload.get(key)
        if isinstance(value, dict):
            containers.append(value)
    for container in containers:
        value = container.get("upload_url") or container.get("uploadUrl") or container.get("url")
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def extract_file_id(payload: dict) -> str:
    if not isinstance(payload, dict):
        return ""
    containers = [payload]
    for key in ["data", "result", "file"]:
        value = payload.get(key)
        if isinstance(value, dict):
            containers.append(value)
    for container in containers:
        value = container.get("file_id") or container.get("fileId") or container.get("id")
        if value is not None:
            return str(value)
    return ""


def rubika_response_error(payload: dict) -> str:
    if not isinstance(payload, dict):
        return "Rubika returned an invalid response"

    for key in ["error", "error_message"]:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    ok = payload.get("ok")
    if ok is False:
        for key in ["description", "message"]:
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return "Rubika returned ok=false"

    status = payload.get("status")
    if isinstance(status, str) and status.strip().lower() not in {"ok", "success"}:
        for key in ["description", "message"]:
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return f"Rubika returned status={status.strip()}"

    data = payload.get("data")
    if isinstance(data, dict):
        for key in ["error", "error_message"]:
            value = data.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

    return ""


def start_attempt(db: Session, post: Post, request_payload: dict, action: str, channel: str = "rubika") -> PublishAttempt:
    now = datetime.utcnow()
    attempt = PublishAttempt(
        post_id=post.id,
        channel=channel,
        action=action,
        status="started",
        request_payload=json_text(request_payload),
        started_at=now,
        created_at=now,
    )
    db.add(attempt)
    post.attempt_count = (post.attempt_count or 0) + 1
    post.updated_at = now
    db.commit()
    db.refresh(attempt)
    return attempt


def finish_success(db: Session, post: Post, attempt: PublishAttempt, response_payload: dict) -> None:
    now = datetime.utcnow()
    attempt.status = "success"
    attempt.response_payload = json_text(response_payload)
    attempt.finished_at = now
    if attempt.channel == "rubika":
        post.rubika_message_id = extract_message_id(response_payload)
    post.updated_at = now
    db.commit()


def finish_failure(db: Session, post: Post, attempt: PublishAttempt, error: str) -> None:
    now = datetime.utcnow()
    attempt.status = "failed"
    attempt.error = error
    attempt.finished_at = now
    post.updated_at = now
    db.commit()


def finish_post_after_channel_attempts(db: Session, post: Post, results: list[dict]) -> None:
    now = datetime.utcnow()
    failures = [result for result in results if not result.get("ok")]
    successes = [result for result in results if result.get("ok")]
    manual_results = [result for result in results if result.get("manual")]

    if not failures:
        post.status = "manual_ready" if manual_results else "published"
        post.published_at = None if manual_results and len(manual_results) == len(results) else now
        post.failed_at = None
        post.last_error = ""
    elif successes:
        post.status = "partially_published"
        post.published_at = post.published_at or now
        post.failed_at = now
        post.last_error = "; ".join(str(result.get("error") or "Unknown channel error") for result in failures)
    else:
        post.status = "failed"
        post.failed_at = now
        post.last_error = "; ".join(str(result.get("error") or "Unknown channel error") for result in failures)

    post.updated_at = now
    db.commit()


def reserve_due_posts(db: Session, now: datetime, limit: int) -> list[Post]:
    posts = db.scalars(
        select(Post)
        .where(Post.status == "scheduled", Post.scheduled_at.is_not(None), Post.scheduled_at <= now)
        .order_by(Post.scheduled_at.asc(), Post.id.asc())
        .limit(limit)
        .with_for_update(skip_locked=True)
    ).all()

    for post in posts:
        post.status = "publishing"
        post.last_error = ""
        post.updated_at = now

    db.commit()
    for post in posts:
        db.refresh(post)
    return list(posts)


def recover_stale_publishing_posts(db: Session, now: datetime, stale_after_minutes: int = 15) -> int:
    cutoff = now - timedelta(minutes=stale_after_minutes)
    posts = db.scalars(
        select(Post)
        .where(Post.status == "publishing", Post.updated_at <= cutoff)
        .order_by(Post.updated_at.asc(), Post.id.asc())
        .with_for_update(skip_locked=True)
    ).all()

    for post in posts:
        post.status = "failed"
        post.failed_at = now
        post.last_error = "Publishing timed out before worker completed"
        post.updated_at = now

    db.commit()
    return len(posts)


def publish_text_post(db: Session, post: Post, action: str = "scheduled", channel: str = "rubika") -> dict:
    account = get_active_rubika_account(db)
    text = build_post_text(post)
    request_payload = {"post_id": post.id, "channel": channel, "text": text, "chat_id": account.chat_id if account else ""}
    attempt = start_attempt(db, post, request_payload, action, channel)

    if account is None or not account.bot_token.strip() or not account.chat_id.strip():
        error = "Rubika account is not configured"
        finish_failure(db, post, attempt, error)
        return {"ok": False, "post_id": post.id, "channel": channel, "error": error}

    try:
        client = RubikaClient(account.bot_token)
        response_payload = asyncio.run(client.send_message(account.chat_id, text))
        response_error = rubika_response_error(response_payload)
        if response_error:
            finish_failure(db, post, attempt, response_error)
            return {"ok": False, "post_id": post.id, "channel": channel, "error": response_error}
        finish_success(db, post, attempt, response_payload)
        return {"ok": True, "post_id": post.id, "channel": channel, "message_id": post.rubika_message_id}
    except Exception as exc:
        error = str(exc)
        finish_failure(db, post, attempt, error)
        return {"ok": False, "post_id": post.id, "channel": channel, "error": error}


def publish_media_post(db: Session, post: Post, asset: MediaAsset, action: str = "scheduled", channel: str = "rubika") -> dict:
    account = get_active_rubika_account(db)
    text = build_post_text(post)
    file_type = rubika_file_type(asset)
    request_payload = {
        "post_id": post.id,
        "mode": "media",
        "channel": channel,
        "chat_id": account.chat_id if account else "",
        "text": text,
        "media_asset_id": asset.id,
        "filename": asset.original_filename,
        "content_type": asset.content_type,
        "size_bytes": asset.size_bytes,
        "file_type": file_type,
    }
    attempt = start_attempt(db, post, request_payload, action, channel)

    if account is None or not account.bot_token.strip() or not account.chat_id.strip():
        error = "Rubika account is not configured"
        finish_failure(db, post, attempt, error)
        return {"ok": False, "post_id": post.id, "channel": channel, "error": error}

    if not Path(asset.file_path).is_file():
        error = "Attached media file is missing"
        finish_failure(db, post, attempt, error)
        return {"ok": False, "post_id": post.id, "channel": channel, "error": error}

    try:
        client = RubikaClient(account.bot_token)
        upload_request_payload = asyncio.run(client.request_send_file(file_type))
        upload_request_error = rubika_response_error(upload_request_payload)
        if upload_request_error:
            finish_failure(db, post, attempt, upload_request_error)
            return {"ok": False, "post_id": post.id, "channel": channel, "error": upload_request_error}

        upload_url = extract_upload_url(upload_request_payload)
        if not upload_url:
            error = "Rubika did not return an upload URL"
            finish_failure(db, post, attempt, error)
            return {"ok": False, "post_id": post.id, "channel": channel, "error": error}

        upload_payload = asyncio.run(client.upload_file(upload_url, asset.file_path, asset.content_type, asset.original_filename))
        upload_error = rubika_response_error(upload_payload)
        if upload_error:
            finish_failure(db, post, attempt, upload_error)
            return {"ok": False, "post_id": post.id, "channel": channel, "error": upload_error}

        file_id = extract_file_id(upload_payload)
        if not file_id:
            error = "Rubika did not return a file ID"
            finish_failure(db, post, attempt, error)
            return {"ok": False, "post_id": post.id, "channel": channel, "error": error}

        send_payload = asyncio.run(client.send_file(account.chat_id, file_id, text))
        send_error = rubika_response_error(send_payload)
        if send_error:
            finish_failure(db, post, attempt, send_error)
            return {"ok": False, "post_id": post.id, "channel": channel, "error": send_error}

        response_payload = {"upload_request": upload_request_payload, "upload": upload_payload, "send": send_payload, "file_id": file_id}
        finish_success(db, post, attempt, response_payload)
        return {"ok": True, "post_id": post.id, "channel": channel, "message_id": post.rubika_message_id, "media_asset_id": asset.id}
    except Exception as exc:
        error = str(exc)
        finish_failure(db, post, attempt, error)
        return {"ok": False, "post_id": post.id, "channel": channel, "error": error}


def publish_instagram_placeholder(db: Session, post: Post, action: str = "scheduled") -> dict:
    account = get_active_instagram_account(db, post.store_id)
    if is_instagram_reminder_ready(account):
        request_payload = {
            "post_id": post.id,
            "channel": "instagram",
            "mode": "reminder",
            "account_type": account.account_type if account else "personal",
            "username": account.username if account else "",
            "manual_steps": ["Send push reminder", "Open Instagram", "Paste caption", "Attach media manually"],
        }
        attempt = start_attempt(db, post, request_payload, action, "instagram")
        now = datetime.utcnow()
        attempt.status = "reminder"
        attempt.response_payload = json_text({"ready_for_manual_publish": True, "username": account.username if account else ""})
        attempt.finished_at = now
        post.updated_at = now
        db.commit()
        return {"ok": True, "post_id": post.id, "channel": "instagram", "manual": True, "mode": "reminder"}

    error = "Instagram publishing requires Meta OAuth before worker delivery"
    request_payload = {
        "post_id": post.id,
        "channel": "instagram",
        "mode": "placeholder",
        "required": ["Meta OAuth", "instagram_content_publish", "professional_account_id"],
    }
    attempt = start_attempt(db, post, request_payload, action, "instagram")
    finish_failure(db, post, attempt, error)
    return {"ok": False, "post_id": post.id, "channel": "instagram", "error": error}


def publish_post(db: Session, post: Post, action: str = "scheduled") -> dict:
    results: list[dict] = []
    asset = get_primary_media_asset(db, post)
    for channel in channel_list(post.platform):
        if channel == "rubika":
            results.append(publish_media_post(db, post, asset, action, channel) if asset is not None else publish_text_post(db, post, action, channel))
        elif channel == "instagram":
            results.append(publish_instagram_placeholder(db, post, action))

    finish_post_after_channel_attempts(db, post, results)
    return {"ok": all(result.get("ok") for result in results), "post_id": post.id, "status": post.status, "channels": results}
