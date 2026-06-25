import json
from datetime import datetime
from urllib.parse import quote

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.database import get_db
from app.dependencies import get_active_store
from app.models import InstagramAccount, InstagramAutomationEvent, InstagramAutomationRule, SavedReply, Store, User
from app.schemas import ConversationAssignRequest, ConversationNoteRequest, ConversationStatusRequest, InstagramAccountResponse, InstagramAutomationCommentSimulationRequest, InstagramAutomationEventListResponse, InstagramAutomationEventResponse, InstagramAutomationIngestResponse, InstagramAutomationRuleListResponse, InstagramAutomationRuleRequest, InstagramAutomationRuleResponse, InstagramAutomationRuleTestRequest, InstagramAutomationRuleTestResponse, InstagramOAuthStartResponse, InstagramSettingsRequest, InstagramTestResponse, SavedReplyListResponse, SavedReplyRequest, SavedReplyResponse
from app.services.instagram_automation import build_simulated_comment_event, clean_keywords, ingest_instagram_comment_events, ingest_instagram_webhook_payload, json_list, normalized_keywords, rule_matches, verify_meta_signature
from app.services.instagram_client import InstagramGraphClient
from app.services.instagram_oauth import build_meta_oauth_url, create_instagram_oauth_state, missing_meta_oauth_config, read_instagram_oauth_state
from app.services.publishing_channels import get_active_instagram_account

router = APIRouter(prefix="/instagram", tags=["instagram"])

ACCOUNT_TYPES = {"personal", "creator", "business"}
PUBLISH_MODES = {"reminder", "direct"}
TRIGGER_TYPES = {"exact", "contains", "code", "any_of"}
RULE_STATUSES = {"draft", "active", "paused", "archived"}


def automation_rule_response(rule: InstagramAutomationRule) -> InstagramAutomationRuleResponse:
    return InstagramAutomationRuleResponse(
        id=rule.id,
        store_id=rule.store_id,
        instagram_account_id=rule.instagram_account_id,
        campaign_id=rule.campaign_id,
        post_id=rule.post_id,
        name=rule.name,
        status=rule.status,
        trigger_type=rule.trigger_type,
        trigger_keywords=json_list(rule.trigger_keywords),
        normalized_keywords=json_list(rule.normalized_keywords),
        private_reply_message=rule.private_reply_message,
        public_reply_enabled=rule.public_reply_enabled,
        public_reply_message=rule.public_reply_message,
        match_limit_per_hour=rule.match_limit_per_hour,
        match_limit_total=rule.match_limit_total,
        starts_at=rule.starts_at,
        ends_at=rule.ends_at,
        is_template=rule.is_template,
        on_customer_reply=rule.on_customer_reply,
        waiting_reply_message=rule.waiting_reply_message,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )


def automation_event_response(event: InstagramAutomationEvent) -> InstagramAutomationEventResponse:
    return InstagramAutomationEventResponse(
        id=event.id,
        store_id=event.store_id,
        rule_id=event.rule_id,
        instagram_account_id=event.instagram_account_id,
        post_id=event.post_id,
        ig_media_id=event.ig_media_id,
        ig_comment_id=event.ig_comment_id,
        commenter_username=event.commenter_username,
        commenter_ig_scoped_id=event.commenter_ig_scoped_id,
        comment_text=event.comment_text,
        normalized_comment_text=event.normalized_comment_text,
        event_status=event.event_status,
        conversation_status=event.conversation_status or "automated",
        automation_paused_until=event.automation_paused_until,
        skip_reason=event.skip_reason,
        failure_reason=event.failure_reason,
        private_reply_message_id=event.private_reply_message_id,
        public_reply_comment_id=event.public_reply_comment_id,
        attempt_count=event.attempt_count,
        last_attempt_at=event.last_attempt_at,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


def automation_ingest_response(summary, events: list[InstagramAutomationEvent]) -> InstagramAutomationIngestResponse:
    return InstagramAutomationIngestResponse(
        received=summary.received,
        created=summary.created,
        duplicates=summary.duplicates,
        matched=summary.matched,
        queued=summary.queued,
        skipped=summary.skipped,
        event_ids=summary.event_ids,
        events=[automation_event_response(event) for event in events],
    )


def enqueue_instagram_automation_events(event_ids: list[int]) -> None:
    if not event_ids:
        return
    from app.worker import process_instagram_automation_event

    for event_id in event_ids:
        process_instagram_automation_event.delay(event_id)


def instagram_frontend_redirect(status: str, message: str = "") -> RedirectResponse:
    settings = get_settings()
    suffix = f"?instagram_oauth={status}"
    if message:
        suffix = f"{suffix}&message={quote(message)}"
    return RedirectResponse(f"{settings.frontend_public_url.rstrip('/')}/instagram{suffix}", status_code=302)

def normalize_account_type(value: str) -> str:
    account_type = value.strip().lower() or "creator"
    return account_type if account_type in ACCOUNT_TYPES else "creator"


def normalize_publish_mode(account_type: str, value: str) -> str:
    publish_mode = value.strip().lower() or ("reminder" if account_type == "personal" else "direct")
    if account_type == "personal":
        return "reminder"
    return publish_mode if publish_mode in PUBLISH_MODES else "direct"


def instagram_response(account: InstagramAccount) -> InstagramAccountResponse:
    masked_token = f"{account.access_token[:6]}..." if account.access_token else ""
    return InstagramAccountResponse(
        id=account.id,
        store_id=account.store_id,
        username=account.username,
        account_type=account.account_type,
        publish_mode=account.publish_mode,
        professional_account_id=account.professional_account_id,
        page_id=account.page_id,
        has_access_token=bool(account.access_token),
        access_token_masked=masked_token,
        token_expires_at=account.token_expires_at,
        status=account.status,
        permissions=account.permissions,
        last_error=account.last_error,
        last_test_at=account.last_test_at,
        is_active=account.is_active,
    )


@router.get("/webhook")
def verify_instagram_webhook(
    mode: str = Query("", alias="hub.mode"),
    verify_token: str = Query("", alias="hub.verify_token"),
    challenge: str = Query("", alias="hub.challenge"),
) -> Response:
    settings = get_settings()
    if mode == "subscribe" and settings.instagram_webhook_verify_token and verify_token == settings.instagram_webhook_verify_token:
        return Response(content=challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Instagram webhook verification failed")


@router.post("/webhook", response_model=InstagramAutomationIngestResponse)
async def receive_instagram_webhook(
    request: Request,
    x_hub_signature_256: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> InstagramAutomationIngestResponse:
    settings = get_settings()
    raw_body = await request.body()
    if not verify_meta_signature(raw_body, x_hub_signature_256, settings.instagram_webhook_app_secret):
        raise HTTPException(status_code=403, detail="Invalid Meta webhook signature")
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook JSON") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook payload must be an object")

    summary = ingest_instagram_webhook_payload(db, payload)
    enqueue_instagram_automation_events(summary.event_ids)
    events = db.scalars(
        select(InstagramAutomationEvent)
        .where(InstagramAutomationEvent.id.in_(summary.event_ids))
        .order_by(InstagramAutomationEvent.created_at.desc(), InstagramAutomationEvent.id.desc())
    ).all() if summary.event_ids else []
    return automation_ingest_response(summary, events)


@router.get("/oauth/start", response_model=InstagramOAuthStartResponse)
def start_instagram_oauth(
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
) -> InstagramOAuthStartResponse:
    settings = get_settings()
    missing = missing_meta_oauth_config()
    if missing:
        return InstagramOAuthStartResponse(
            configured=False,
            redirect_uri=settings.meta_oauth_redirect_uri,
            scopes=settings.meta_oauth_scope_list,
            missing=missing,
        )
    state = create_instagram_oauth_state(store.id, current_user.id)
    return InstagramOAuthStartResponse(
        configured=True,
        authorization_url=build_meta_oauth_url(state),
        redirect_uri=settings.meta_oauth_redirect_uri,
        scopes=settings.meta_oauth_scope_list,
        missing=[],
    )


@router.get("/oauth/callback")
def finish_instagram_oauth(
    code: str = "",
    state: str = "",
    error: str = "",
    error_description: str = "",
    db: Session = Depends(get_db),
):
    if error:
        return instagram_frontend_redirect("error", error_description or error)
    if not code or not state:
        return instagram_frontend_redirect("error", "Meta OAuth callback is missing code or state")
    try:
        state_payload = read_instagram_oauth_state(state)
    except ValueError as exc:
        return instagram_frontend_redirect("error", str(exc))

    settings = get_settings()
    missing = missing_meta_oauth_config()
    if missing:
        return instagram_frontend_redirect("error", f"Missing Meta OAuth config: {', '.join(missing)}")

    store_id = int(state_payload.get("store_id") or 0)
    store = db.get(Store, store_id)
    if store is None:
        return instagram_frontend_redirect("error", "Store was not found for Meta OAuth callback")

    client = InstagramGraphClient()
    short_token = client.exchange_code_for_user_token(settings.meta_app_id, settings.meta_app_secret, settings.meta_oauth_redirect_uri, code)
    if not short_token.ok or not short_token.access_token:
        return instagram_frontend_redirect("error", short_token.error or "Meta OAuth code exchange failed")
    long_token = client.exchange_long_lived_user_token(settings.meta_app_id, settings.meta_app_secret, short_token.access_token)
    user_access_token = long_token.access_token if long_token.ok and long_token.access_token else short_token.access_token
    token_expires_at = long_token.expires_at or short_token.expires_at

    connection = client.find_instagram_page_connection(user_access_token)
    if not connection.ok:
        return instagram_frontend_redirect("error", connection.error or "No linked Instagram professional account found")

    account = get_active_instagram_account(db, store.id)
    if account is None:
        account = InstagramAccount(store_id=store.id)
        db.add(account)
    account.username = connection.username
    account.account_type = "business"
    account.publish_mode = "direct"
    account.professional_account_id = connection.professional_account_id
    account.page_id = connection.page_id
    account.access_token = connection.page_access_token
    account.token_expires_at = token_expires_at
    account.permissions = ",".join(settings.meta_oauth_scope_list)
    account.status = "connected"
    account.last_error = ""
    account.last_test_at = datetime.utcnow()
    account.updated_at = datetime.utcnow()
    db.commit()
    return instagram_frontend_redirect("success", f"Connected Instagram account {connection.username or connection.professional_account_id}")


@router.get("/settings")
def read_settings(store: Store = Depends(get_active_store), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = get_active_instagram_account(db, store.id)
    if account is None:
        return None
    return instagram_response(account)


@router.put("/settings", response_model=InstagramAccountResponse)
def save_settings(
    payload: InstagramSettingsRequest,
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstagramAccountResponse:
    account = get_active_instagram_account(db, store.id)
    if account is None:
        account = InstagramAccount(store_id=store.id)
        db.add(account)

    account_type = normalize_account_type(payload.account_type)
    publish_mode = normalize_publish_mode(account_type, payload.publish_mode)

    account.username = payload.username.strip()
    account.account_type = account_type
    account.publish_mode = publish_mode
    account.professional_account_id = payload.professional_account_id.strip()
    account.page_id = payload.page_id.strip()
    if payload.access_token.strip():
        account.access_token = payload.access_token.strip()
    account.token_expires_at = payload.token_expires_at
    account.permissions = payload.permissions.strip()
    direct_ready = bool(account.professional_account_id and account.page_id and account.access_token)
    account.status = "reminder_ready" if publish_mode == "reminder" else ("connected" if direct_ready else "oauth_required")
    account.last_error = "" if publish_mode == "reminder" or direct_ready else "Meta OAuth, Page ID, Professional Account ID, and access token are required"
    account.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(account)
    return instagram_response(account)


@router.post("/test", response_model=InstagramTestResponse)
def test_connection(
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstagramTestResponse:
    account = get_active_instagram_account(db, store.id)
    now = datetime.utcnow()
    if account is not None:
        if account.publish_mode == "reminder":
            account.status = "reminder_ready"
            account.last_error = ""
            account.last_test_at = now
            account.updated_at = now
            db.commit()
            return InstagramTestResponse(
                ok=True,
                status="reminder_ready",
                error="Personal Instagram account is ready for manual reminder publishing",
                last_test_at=now,
            )
        direct_ready = bool(account.professional_account_id and account.page_id and account.access_token)
        account.status = "connected" if direct_ready else "oauth_required"
        account.last_error = "" if direct_ready else "Meta OAuth, instagram_basic, instagram_content_publish, page linkage, and token are required"
        account.last_test_at = now
        account.updated_at = now
        db.commit()
        if direct_ready:
            return InstagramTestResponse(
                ok=True,
                status="connected",
                error="Instagram professional account has the required local OAuth fields",
                last_test_at=now,
            )
    return InstagramTestResponse(
        ok=False,
        status="oauth_required",
        error="Meta OAuth is not connected yet",
        last_test_at=now,
    )


@router.get("/automation/rules", response_model=InstagramAutomationRuleListResponse)
def list_automation_rules(
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstagramAutomationRuleListResponse:
    rules = db.scalars(
        select(InstagramAutomationRule)
        .where(InstagramAutomationRule.store_id == store.id)
        .order_by(InstagramAutomationRule.updated_at.desc(), InstagramAutomationRule.id.desc())
    ).all()
    return InstagramAutomationRuleListResponse(rules=[automation_rule_response(rule) for rule in rules], total=len(rules))


@router.post("/automation/rules", response_model=InstagramAutomationRuleResponse)
def create_automation_rule(
    payload: InstagramAutomationRuleRequest,
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstagramAutomationRuleResponse:
    trigger_type = payload.trigger_type.strip().lower() or "exact"
    if trigger_type not in TRIGGER_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported trigger type")
    status = payload.status.strip().lower() or "draft"
    if status not in RULE_STATUSES:
        raise HTTPException(status_code=400, detail="Unsupported rule status")
    keywords = clean_keywords(payload.trigger_keywords)
    normalized = normalized_keywords(keywords)
    if not normalized:
        raise HTTPException(status_code=400, detail="At least one trigger keyword is required")
    if not payload.private_reply_message.strip():
        raise HTTPException(status_code=400, detail="Private reply message is required")
    account = get_active_instagram_account(db, store.id)
    if status == "active" and (account is None or account.publish_mode == "reminder" or account.status != "connected" or not account.access_token):
        raise HTTPException(status_code=400, detail="Active automation requires an Instagram professional account")
    now = datetime.utcnow()
    rule = InstagramAutomationRule(
        store_id=store.id,
        instagram_account_id=account.id if account else None,
        campaign_id=payload.campaign_id,
        post_id=payload.post_id,
        name=payload.name.strip() or f"Instagram trigger: {keywords[0]}",
        status=status,
        trigger_type=trigger_type,
        trigger_keywords=json.dumps(keywords, ensure_ascii=False),
        normalized_keywords=json.dumps(normalized, ensure_ascii=False),
        private_reply_message=payload.private_reply_message.strip(),
        public_reply_enabled=payload.public_reply_enabled,
        public_reply_message=payload.public_reply_message.strip(),
        match_limit_per_hour=max(1, min(payload.match_limit_per_hour, 750)),
        match_limit_total=max(0, payload.match_limit_total),
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        is_template=payload.is_template,
        on_customer_reply=payload.on_customer_reply.strip().lower() or "hand_off",
        waiting_reply_message=payload.waiting_reply_message.strip() if payload.waiting_reply_message else None,
        created_at=now,
        updated_at=now,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return automation_rule_response(rule)


@router.get("/automation/rules/{rule_id}", response_model=InstagramAutomationRuleResponse)
def get_automation_rule(
    rule_id: int,
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstagramAutomationRuleResponse:
    rule = db.scalar(select(InstagramAutomationRule).where(
        InstagramAutomationRule.id == rule_id,
        InstagramAutomationRule.store_id == store.id
    ))
    if rule is None:
        raise HTTPException(status_code=404, detail="Automation rule not found")
    return automation_rule_response(rule)


@router.put("/automation/rules/{rule_id}", response_model=InstagramAutomationRuleResponse)
def update_automation_rule(
    rule_id: int,
    payload: InstagramAutomationRuleRequest,
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstagramAutomationRuleResponse:
    rule = db.scalar(select(InstagramAutomationRule).where(
        InstagramAutomationRule.id == rule_id,
        InstagramAutomationRule.store_id == store.id
    ))
    if rule is None:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    trigger_type = payload.trigger_type.strip().lower() or "exact"
    if trigger_type not in TRIGGER_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported trigger type")
    status = payload.status.strip().lower() or "draft"
    if status not in RULE_STATUSES:
        raise HTTPException(status_code=400, detail="Unsupported rule status")
    keywords = clean_keywords(payload.trigger_keywords)
    normalized = normalized_keywords(keywords)
    if not normalized:
        raise HTTPException(status_code=400, detail="At least one trigger keyword is required")
    if not payload.private_reply_message.strip():
        raise HTTPException(status_code=400, detail="Private reply message is required")

    account = get_active_instagram_account(db, store.id)
    if status == "active" and (account is None or account.publish_mode == "reminder" or account.status != "connected" or not account.access_token):
        raise HTTPException(status_code=400, detail="Active automation requires an Instagram professional account")

    rule.campaign_id = payload.campaign_id
    rule.post_id = payload.post_id
    rule.name = payload.name.strip() or f"Instagram trigger: {keywords[0]}"
    rule.status = status
    rule.trigger_type = trigger_type
    rule.trigger_keywords = json.dumps(keywords, ensure_ascii=False)
    rule.normalized_keywords = json.dumps(normalized, ensure_ascii=False)
    rule.private_reply_message = payload.private_reply_message.strip()
    rule.public_reply_enabled = payload.public_reply_enabled
    rule.public_reply_message = payload.public_reply_message.strip()
    rule.match_limit_per_hour = max(1, min(payload.match_limit_per_hour, 750))
    rule.match_limit_total = max(0, payload.match_limit_total)
    rule.starts_at = payload.starts_at
    rule.ends_at = payload.ends_at
    rule.is_template = payload.is_template
    rule.on_customer_reply = payload.on_customer_reply.strip().lower() or "hand_off"
    rule.waiting_reply_message = payload.waiting_reply_message.strip() if payload.waiting_reply_message else None
    rule.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(rule)
    return automation_rule_response(rule)


@router.delete("/automation/rules/{rule_id}")
def delete_automation_rule(
    rule_id: int,
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rule = db.scalar(select(InstagramAutomationRule).where(
        InstagramAutomationRule.id == rule_id,
        InstagramAutomationRule.store_id == store.id
    ))
    if rule is None:
        raise HTTPException(status_code=404, detail="Automation rule not found")
    
    db.delete(rule)
    db.commit()
    return {"ok": True, "message": "Automation rule deleted successfully"}


@router.post("/automation/rules/{rule_id}/test", response_model=InstagramAutomationRuleTestResponse)
def test_automation_rule(
    rule_id: int,
    payload: InstagramAutomationRuleTestRequest,
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstagramAutomationRuleTestResponse:
    rule = db.scalar(select(InstagramAutomationRule).where(InstagramAutomationRule.id == rule_id, InstagramAutomationRule.store_id == store.id))
    if rule is None:
        raise HTTPException(status_code=404, detail="Automation rule not found")
    matched, normalized_comment, reason = rule_matches(rule, payload.comment_text)
    return InstagramAutomationRuleTestResponse(
        matched=matched,
        normalized_comment_text=normalized_comment,
        normalized_keywords=json_list(rule.normalized_keywords),
        reason=reason,
    )


@router.get("/automation/events", response_model=InstagramAutomationEventListResponse)
def list_automation_events(
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstagramAutomationEventListResponse:
    events = db.scalars(
        select(InstagramAutomationEvent)
        .where(InstagramAutomationEvent.store_id == store.id)
        .order_by(InstagramAutomationEvent.created_at.desc(), InstagramAutomationEvent.id.desc())
        .limit(100)
    ).all()
    return InstagramAutomationEventListResponse(events=[automation_event_response(event) for event in events], total=len(events))


@router.post("/automation/simulate-comment", response_model=InstagramAutomationIngestResponse)
def simulate_automation_comment(
    payload: InstagramAutomationCommentSimulationRequest,
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstagramAutomationIngestResponse:
    account = get_active_instagram_account(db, store.id)
    if account is None:
        raise HTTPException(status_code=400, detail="Instagram account is not configured")
    comment_text = payload.comment_text.strip()
    if not comment_text:
        raise HTTPException(status_code=400, detail="Comment text is required")
    comment_id = payload.ig_comment_id.strip() or f"local-{int(datetime.utcnow().timestamp() * 1000)}"
    event = build_simulated_comment_event(
        account=account,
        comment_text=comment_text,
        comment_id=comment_id,
        media_id=payload.ig_media_id.strip() or "local-media",
        username=payload.commenter_username.strip() or "local_tester",
    )
    summary = ingest_instagram_comment_events(db, [event])
    enqueue_instagram_automation_events(summary.event_ids)
    events = db.scalars(
        select(InstagramAutomationEvent)
        .where(InstagramAutomationEvent.id.in_(summary.event_ids))
        .order_by(InstagramAutomationEvent.created_at.desc(), InstagramAutomationEvent.id.desc())
    ).all() if summary.event_ids else []
    return automation_ingest_response(summary, events)


@router.put("/automation/events/{event_id}/assign", response_model=InstagramAutomationEventResponse)
def assign_automation_event(
    event_id: int,
    payload: ConversationAssignRequest,
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstagramAutomationEventResponse:
    event = db.scalar(select(InstagramAutomationEvent).where(
        InstagramAutomationEvent.id == event_id,
        InstagramAutomationEvent.store_id == store.id
    ))
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    
    event.assigned_to = payload.assigned_to
    event.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(event)
    return automation_event_response(event)


@router.put("/automation/events/{event_id}/note", response_model=InstagramAutomationEventResponse)
def update_automation_event_note(
    event_id: int,
    payload: ConversationNoteRequest,
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstagramAutomationEventResponse:
    event = db.scalar(select(InstagramAutomationEvent).where(
        InstagramAutomationEvent.id == event_id,
        InstagramAutomationEvent.store_id == store.id
    ))
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    
    event.internal_note = payload.internal_note
    event.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(event)
    return automation_event_response(event)


@router.put("/automation/events/{event_id}/status", response_model=InstagramAutomationEventResponse)
def update_automation_event_status(
    event_id: int,
    payload: ConversationStatusRequest,
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstagramAutomationEventResponse:
    event = db.scalar(select(InstagramAutomationEvent).where(
        InstagramAutomationEvent.id == event_id,
        InstagramAutomationEvent.store_id == store.id
    ))
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    
    event.conversation_status = payload.conversation_status
    event.automation_paused_until = payload.automation_paused_until
    event.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(event)
    return automation_event_response(event)


@router.get("/automation/saved-replies", response_model=SavedReplyListResponse)
def list_saved_replies(
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedReplyListResponse:
    replies = db.scalars(
        select(SavedReply)
        .where(SavedReply.store_id == store.id)
        .order_by(SavedReply.created_at.desc())
    ).all()
    
    return SavedReplyListResponse(
        replies=[
            SavedReplyResponse(
                id=r.id,
                store_id=r.store_id,
                title=r.title,
                content=r.content,
                created_at=r.created_at,
                updated_at=r.updated_at
            ) for r in replies
        ],
        total=len(replies)
    )


@router.post("/automation/saved-replies", response_model=SavedReplyResponse)
def create_saved_reply(
    payload: SavedReplyRequest,
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedReplyResponse:
    reply = SavedReply(
        store_id=store.id,
        title=payload.title,
        content=payload.content,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)
    
    return SavedReplyResponse(
        id=reply.id,
        store_id=reply.store_id,
        title=reply.title,
        content=reply.content,
        created_at=reply.created_at,
        updated_at=reply.updated_at
    )


@router.delete("/automation/saved-replies/{reply_id}")
def delete_saved_reply(
    reply_id: int,
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reply = db.scalar(select(SavedReply).where(
        SavedReply.id == reply_id,
        SavedReply.store_id == store.id
    ))
    if reply is None:
        raise HTTPException(status_code=404, detail="Saved reply not found")
    
    db.delete(reply)
    db.commit()
    return {"ok": True, "message": "Saved reply deleted successfully"}
