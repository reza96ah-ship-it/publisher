from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import InstagramAccount, InstagramAutomationEvent, InstagramAutomationRule, PublishAttempt
from app.services.instagram_client import InstagramGraphClient

PERSIAN_DIGIT_MAP = str.maketrans(
    "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669",
    "01234567890123456789",
)


@dataclass(frozen=True)
class InstagramCommentEvent:
    account_ref: str
    ig_media_id: str
    ig_comment_id: str
    commenter_username: str
    commenter_ig_scoped_id: str
    comment_text: str
    raw: dict[str, Any]


@dataclass(frozen=True)
class InstagramAutomationIngestSummary:
    received: int
    created: int
    duplicates: int
    matched: int
    queued: int
    skipped: int
    event_ids: list[int]


def normalize_trigger_text(value: str) -> str:
    return " ".join(value.translate(PERSIAN_DIGIT_MAP).strip().lower().split())


def clean_keywords(values: list[str]) -> list[str]:
    keywords: list[str] = []
    for value in values:
        keyword = value.strip()
        if keyword and keyword not in keywords:
            keywords.append(keyword)
    return keywords


def normalized_keywords(values: list[str]) -> list[str]:
    return [normalize_trigger_text(value) for value in values if normalize_trigger_text(value)]


def json_list(value: str) -> list[str]:
    try:
        parsed = json.loads(value or "[]")
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return []


def json_text(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def rule_matches(rule: InstagramAutomationRule, comment_text: str) -> tuple[bool, str, str]:
    normalized_comment = normalize_trigger_text(comment_text)
    keywords = json_list(rule.normalized_keywords)
    if not normalized_comment:
        return False, normalized_comment, "Comment is empty."
    if not keywords:
        return False, normalized_comment, "Rule has no keywords."
    if rule.trigger_type in {"exact", "code"}:
        return normalized_comment in keywords, normalized_comment, "Exact match evaluated."
    if rule.trigger_type in {"contains", "any_of"}:
        return any(keyword in normalized_comment for keyword in keywords), normalized_comment, "Contains match evaluated."
    return False, normalized_comment, "Unsupported trigger type."


def verify_meta_signature(raw_body: bytes, signature_header: str | None, app_secret: str) -> bool:
    if not app_secret:
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    provided = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(provided, expected)


def find_nested_text(value: Any, keys: tuple[str, ...]) -> str:
    if not isinstance(value, dict):
        return ""
    for key in keys:
        item = value.get(key)
        if isinstance(item, str) and item.strip():
            return item.strip()
    return ""


def extract_comment_from_change(entry_id: str, change: dict[str, Any]) -> InstagramCommentEvent | None:
    value = change.get("value") if isinstance(change.get("value"), dict) else {}
    field = str(change.get("field") or value.get("field") or "").lower()
    if field and "comment" not in field:
        return None

    comment_id = find_nested_text(value, ("comment_id", "ig_comment_id", "id"))
    media = value.get("media") if isinstance(value.get("media"), dict) else {}
    media_id = find_nested_text(value, ("media_id", "ig_media_id", "post_id")) or find_nested_text(media, ("id", "media_id"))
    text = find_nested_text(value, ("text", "message", "body", "comment_text"))
    from_data = value.get("from") if isinstance(value.get("from"), dict) else {}
    username = find_nested_text(from_data, ("username", "name")) or find_nested_text(value, ("username", "commenter_username"))
    user_id = find_nested_text(from_data, ("id",)) or find_nested_text(value, ("user_id",))
    account_ref = find_nested_text(value, ("recipient_id", "account_id", "ig_user_id", "page_id")) or entry_id

    if not comment_id or not text:
        return None
    return InstagramCommentEvent(
        account_ref=account_ref,
        ig_media_id=media_id,
        ig_comment_id=comment_id,
        commenter_username=username or user_id or "unknown",
        commenter_ig_scoped_id=user_id or "",
        comment_text=text,
        raw=change,
    )


def extract_comment_from_messaging(entry_id: str, messaging: dict[str, Any]) -> InstagramCommentEvent | None:
    message = messaging.get("message") if isinstance(messaging.get("message"), dict) else {}
    referral = message.get("referral") if isinstance(message.get("referral"), dict) else {}
    reply_to = message.get("reply_to") if isinstance(message.get("reply_to"), dict) else {}
    comment_id = find_nested_text(referral, ("comment_id", "source_id")) or find_nested_text(reply_to, ("mid", "story_id"))
    text = find_nested_text(message, ("text",))
    sender = messaging.get("sender") if isinstance(messaging.get("sender"), dict) else {}
    recipient = messaging.get("recipient") if isinstance(messaging.get("recipient"), dict) else {}
    account_ref = find_nested_text(recipient, ("id",)) or entry_id
    user_id = find_nested_text(sender, ("id",))
    username = find_nested_text(sender, ("username",))

    if not comment_id or not text:
        return None
    return InstagramCommentEvent(
        account_ref=account_ref,
        ig_media_id=find_nested_text(referral, ("post_id", "media_id")),
        ig_comment_id=comment_id,
        commenter_username=username or user_id or "unknown",
        commenter_ig_scoped_id=user_id or "",
        comment_text=text,
        raw=messaging,
    )


def extract_instagram_comment_events(payload: dict[str, Any]) -> list[InstagramCommentEvent]:
    events: list[InstagramCommentEvent] = []
    for entry in payload.get("entry", []):
        if not isinstance(entry, dict):
            continue
        entry_id = str(entry.get("id") or "")
        for change in entry.get("changes", []):
            if isinstance(change, dict):
                event = extract_comment_from_change(entry_id, change)
                if event is not None:
                    events.append(event)
        for messaging in entry.get("messaging", []):
            if isinstance(messaging, dict):
                event = extract_comment_from_messaging(entry_id, messaging)
                if event is not None:
                    events.append(event)
    return events


def active_rules_for_event(db: Session, account: InstagramAccount, event: InstagramCommentEvent, now: datetime) -> list[InstagramAutomationRule]:
    # Check if commenter has automation paused to prevent infinite loop / operator takeover
    if event.commenter_ig_scoped_id or event.commenter_username:
        paused = db.scalar(
            select(InstagramAutomationEvent.id)
            .where(
                InstagramAutomationEvent.store_id == account.store_id,
                (InstagramAutomationEvent.commenter_ig_scoped_id == event.commenter_ig_scoped_id) |
                (InstagramAutomationEvent.commenter_username == event.commenter_username),
                InstagramAutomationEvent.automation_paused_until > now
            )
            .limit(1)
        )
        if paused:
            # Commenter has paused automation, return no rules
            return []

    rules = db.scalars(
        select(InstagramAutomationRule)
        .where(
            InstagramAutomationRule.store_id == account.store_id,
            InstagramAutomationRule.status == "active",
        )
        .order_by(InstagramAutomationRule.updated_at.desc(), InstagramAutomationRule.id.desc())
    ).all()
    eligible: list[InstagramAutomationRule] = []
    for rule in rules:
        if rule.instagram_account_id is not None and rule.instagram_account_id != account.id:
            continue
        if rule.starts_at is not None and rule.starts_at > now:
            continue
        if rule.ends_at is not None and rule.ends_at < now:
            continue
        
        # Post-specific rule matching via PublishAttempt response_payload
        if rule.post_id is not None:
            attempts = db.scalars(
                select(PublishAttempt)
                .where(
                    PublishAttempt.post_id == rule.post_id,
                    PublishAttempt.channel == "instagram",
                    PublishAttempt.status.in_(["success", "reminder"])
                )
            ).all()
            matched_media = False
            for attempt in attempts:
                try:
                    payload = json.loads(attempt.response_payload or "{}")
                    media_id = str(payload.get("media_id") or payload.get("ig_media_id") or payload.get("id") or payload.get("media_fbid") or "")
                    if media_id and event.ig_media_id and media_id == str(event.ig_media_id):
                        matched_media = True
                        break
                except Exception:
                    continue
            if not matched_media:
                continue

        eligible.append(rule)
    return eligible


def limit_exceeded(db: Session, rule: InstagramAutomationRule, now: datetime) -> str:
    if rule.match_limit_total > 0:
        total = db.scalar(
            select(func.count(InstagramAutomationEvent.id)).where(
                InstagramAutomationEvent.rule_id == rule.id,
                InstagramAutomationEvent.event_status.in_(["matched", "queued", "dry_run", "sent"]),
            )
        )
        if total is not None and total >= rule.match_limit_total:
            return "Rule total match limit reached."

    hour_start = now - timedelta(hours=1)
    hourly = db.scalar(
        select(func.count(InstagramAutomationEvent.id)).where(
            InstagramAutomationEvent.rule_id == rule.id,
            InstagramAutomationEvent.created_at >= hour_start,
            InstagramAutomationEvent.event_status.in_(["matched", "queued", "dry_run", "sent"]),
        )
    )
    if hourly is not None and hourly >= rule.match_limit_per_hour:
        return "Rule hourly match limit reached."
    return ""


def find_account_for_event(db: Session, event: InstagramCommentEvent) -> InstagramAccount | None:
    account_refs = [event.account_ref, event.raw.get("recipient_id") if isinstance(event.raw, dict) else ""]
    account_refs = [str(value) for value in account_refs if value]
    if account_refs:
        account = db.scalar(
            select(InstagramAccount).where(
                InstagramAccount.is_active.is_(True),
                InstagramAccount.status.in_(["connected", "oauth_required"]),
                InstagramAccount.professional_account_id.in_(account_refs),
            )
        )
        if account is not None:
            return account
        account = db.scalar(
            select(InstagramAccount).where(
                InstagramAccount.is_active.is_(True),
                InstagramAccount.status.in_(["connected", "oauth_required"]),
                InstagramAccount.page_id.in_(account_refs),
            )
        )
        if account is not None:
            return account
    return None


def ingest_instagram_comment_events(db: Session, events: list[InstagramCommentEvent]) -> InstagramAutomationIngestSummary:
    now = datetime.utcnow()
    created = 0
    duplicates = 0
    matched = 0
    queued = 0
    skipped = 0
    event_ids: list[int] = []

    for event in events:
        if db.scalar(select(InstagramAutomationEvent).where(InstagramAutomationEvent.ig_comment_id == event.ig_comment_id)) is not None:
            duplicates += 1
            continue

        account = find_account_for_event(db, event)
        if account is None:
            skipped += 1
            continue

        normalized_comment = normalize_trigger_text(event.comment_text)
        automation_event = InstagramAutomationEvent(
            store_id=account.store_id,
            instagram_account_id=account.id,
            ig_media_id=event.ig_media_id,
            ig_comment_id=event.ig_comment_id,
            commenter_username=event.commenter_username,
            commenter_ig_scoped_id=event.commenter_ig_scoped_id,
            comment_text=event.comment_text,
            normalized_comment_text=normalized_comment,
            event_status="no_match",
            skip_reason="No active automation rule matched this comment.",
            webhook_payload=json_text(event.raw),
            created_at=now,
            updated_at=now,
        )

        for rule in active_rules_for_event(db, account, event, now):
            does_match, _, reason = rule_matches(rule, event.comment_text)
            if not does_match:
                continue
            limit_reason = limit_exceeded(db, rule, now)
            automation_event.rule_id = rule.id
            automation_event.event_status = "rate_limited" if limit_reason else "matched"
            automation_event.skip_reason = limit_reason
            automation_event.failure_reason = "" if not limit_reason else reason
            if not limit_reason:
                matched += 1
            break

        db.add(automation_event)
        db.flush()
        created += 1
        event_ids.append(automation_event.id)
        if automation_event.event_status == "matched":
            automation_event.event_status = "queued"
            automation_event.updated_at = now
            queued += 1

    db.commit()
    return InstagramAutomationIngestSummary(
        received=len(events),
        created=created,
        duplicates=duplicates,
        matched=matched,
        queued=queued,
        skipped=skipped,
        event_ids=event_ids,
    )


def process_messaging_reply(db: Session, payload: dict[str, Any]) -> int:
    """
    Parses direct messaging events to check if a customer replied to an automated DM.
    If so, flags the thread as waiting for operator, pauses automation, and optionally
    sends a waiting message or triggers a notification.
    Returns the number of threads/events updated.
    """
    now = datetime.utcnow()
    updated_count = 0
    
    for entry in payload.get("entry", []):
        if not isinstance(entry, dict):
            continue
        page_id = str(entry.get("id") or "")
        for messaging in entry.get("messaging", []):
            if not isinstance(messaging, dict):
                continue
            
            message = messaging.get("message")
            if not isinstance(message, dict):
                continue
            
            # Check if this message was sent by a customer (sender.id != page_id)
            sender = messaging.get("sender") or {}
            sender_id = str(sender.get("id") or "")
            if not sender_id or sender_id == page_id:
                continue
                
            text = message.get("text") or ""
            reply_to = message.get("reply_to") or {}
            reply_to_mid = str(reply_to.get("mid") or "")
            
            # Find a matching automation event. 
            event = None
            if reply_to_mid:
                event = db.scalar(
                    select(InstagramAutomationEvent)
                    .where(
                        InstagramAutomationEvent.private_reply_message_id == reply_to_mid,
                        InstagramAutomationEvent.event_status == "sent"
                    )
                )
            
            if event is None and sender_id:
                # fallback: find the most recent sent event for this commenter scoping id or username
                event = db.scalar(
                    select(InstagramAutomationEvent)
                    .where(
                        (InstagramAutomationEvent.commenter_ig_scoped_id == sender_id) | 
                        (InstagramAutomationEvent.commenter_username == sender_id),
                        InstagramAutomationEvent.event_status == "sent",
                        InstagramAutomationEvent.created_at >= now - timedelta(hours=24)
                    )
                    .order_by(InstagramAutomationEvent.created_at.desc())
                )
                
            if event is not None:
                if event.conversation_status != "waiting_operator":
                    event.conversation_status = "waiting_operator"
                    event.automation_paused_until = now + timedelta(days=7)
                    event.updated_at = now
                    
                    if not event.commenter_ig_scoped_id:
                        event.commenter_ig_scoped_id = sender_id
                        
                    db.flush()
                    
                    # Trigger an operational notification dynamically (handled in routes/notifications.py)
                    # We just save the event status and update the comment text to log the reply
                    event.comment_text = text if text else event.comment_text
                        
                    # Check if the rule has a waiting reply message configured
                    rule = db.get(InstagramAutomationRule, event.rule_id) if event.rule_id else None
                    if rule and rule.on_customer_reply == "send_waiting_message" and rule.waiting_reply_message:
                        account = db.get(InstagramAccount, event.instagram_account_id) if event.instagram_account_id else None
                        if account and account.access_token:
                            from app.worker import send_instagram_direct_message
                            send_instagram_direct_message.delay(
                                account.page_id,
                                account.access_token,
                                sender_id,
                                rule.waiting_reply_message
                            )
                    
                    updated_count += 1
                    
    if updated_count > 0:
        db.commit()
    return updated_count


def ingest_instagram_webhook_payload(db: Session, payload: dict[str, Any]) -> InstagramAutomationIngestSummary:
    # First, process messaging replies for operator takeover
    process_messaging_reply(db, payload)
    # Then ingest standard comment events
    return ingest_instagram_comment_events(db, extract_instagram_comment_events(payload))


def build_simulated_comment_event(account: InstagramAccount, comment_text: str, comment_id: str, media_id: str, username: str) -> InstagramCommentEvent:
    now_ms = int(datetime.utcnow().timestamp() * 1000)
    raw = {
        "field": "comments",
        "value": {
            "id": comment_id,
            "media_id": media_id,
            "text": comment_text,
            "from": {"username": username},
            "account_id": account.professional_account_id or account.page_id or str(account.id),
            "created_time": now_ms,
        },
    }
    return InstagramCommentEvent(
        account_ref=account.professional_account_id or account.page_id or str(account.id),
        ig_media_id=media_id,
        ig_comment_id=comment_id,
        commenter_username=username,
        commenter_ig_scoped_id=f"scoped-{username}",
        comment_text=comment_text,
        raw=raw,
    )


def process_instagram_automation_event(db: Session, event_id: int, client: InstagramGraphClient | None = None) -> dict[str, Any]:
    settings = get_settings()
    now = datetime.utcnow()
    event = db.get(InstagramAutomationEvent, event_id)
    if event is None:
        return {"ok": False, "event_id": event_id, "error": "Automation event not found"}
    rule = db.get(InstagramAutomationRule, event.rule_id) if event.rule_id else None
    account = db.get(InstagramAccount, event.instagram_account_id) if event.instagram_account_id else None

    event.attempt_count += 1
    event.last_attempt_at = now
    event.updated_at = now

    if rule is None:
        event.event_status = "blocked"
        event.failure_reason = "Automation rule not found"
        db.commit()
        return {"ok": False, "event_id": event.id, "status": event.event_status, "error": event.failure_reason}
    if account is None:
        event.event_status = "blocked"
        event.failure_reason = "Instagram account not found"
        db.commit()
        return {"ok": False, "event_id": event.id, "status": event.event_status, "error": event.failure_reason}
    if account.publish_mode == "reminder" or account.status != "connected":
        event.event_status = "blocked"
        event.failure_reason = "Instagram professional account must be connected before automation can send"
        db.commit()
        return {"ok": False, "event_id": event.id, "status": event.event_status, "error": event.failure_reason}
    if not account.access_token:
        event.event_status = "blocked"
        event.failure_reason = "Meta access token is not configured"
        db.commit()
        return {"ok": False, "event_id": event.id, "status": event.event_status, "error": event.failure_reason}
    if not settings.instagram_automation_dispatch_enabled:
        event.event_status = "dry_run"
        event.failure_reason = "Instagram automation dispatch is disabled by configuration"
        db.commit()
        return {"ok": True, "event_id": event.id, "status": event.event_status, "dry_run": True}

    graph = client or InstagramGraphClient()
    private_result = graph.send_private_reply(account.page_id, account.access_token, event.ig_comment_id, rule.private_reply_message)
    if not private_result.ok:
        event.event_status = "failed"
        event.failure_reason = private_result.error
        db.commit()
        return {"ok": False, "event_id": event.id, "status": event.event_status, "error": event.failure_reason}

    event.private_reply_message_id = private_result.message_id
    if rule.public_reply_enabled and rule.public_reply_message.strip():
        public_result = graph.send_public_comment_reply(account.access_token, event.ig_comment_id, rule.public_reply_message)
        if public_result.ok:
            event.public_reply_comment_id = public_result.comment_id
        else:
            event.failure_reason = public_result.error
    event.event_status = "sent"
    db.commit()
    return {"ok": True, "event_id": event.id, "status": event.event_status, "message_id": event.private_reply_message_id}
