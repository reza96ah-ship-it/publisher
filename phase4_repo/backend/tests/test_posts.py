from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Campaign, InstagramAccount, Post, RubikaAccount, Store, User
from app.routes.posts import apply_payload, approve_post, bulk_assign_campaign, bulk_change_status, change_status, mark_manual_published, post_response, request_post_changes, retry_all_failed_posts, retry_failed_post, router, schedule_post, submit_post_for_review
from app.schemas import BulkPostCampaignRequest, BulkPostStatusRequest, PostRequest, PostReviewRequest, PostScheduleRequest, PostStatusRequest


def test_apply_payload_stores_aware_schedule_as_utc_naive() -> None:
    tehran = timezone(timedelta(hours=3, minutes=30))
    now = datetime(2026, 1, 1, 12, 0, 0)
    post = Post(store_id=1, title="", created_at=now, updated_at=now)
    payload = PostRequest(title="Launch", scheduled_at=datetime(2026, 1, 10, 9, 15, tzinfo=tehran), timezone="")

    apply_payload(post, payload)

    assert post.scheduled_at == datetime(2026, 1, 10, 5, 45)
    assert post.scheduled_at.tzinfo is None
    assert post.timezone == "Asia/Tehran"


def test_apply_payload_normalizes_multi_channel_platforms() -> None:
    now = datetime(2026, 1, 1, 12, 0, 0)
    post = Post(store_id=1, title="", created_at=now, updated_at=now)
    payload = PostRequest(title="Launch", platform=" Rubika, instagram, rubika ")

    apply_payload(post, payload)

    assert post.platform == "rubika,instagram"


def test_post_response_returns_stored_naive_datetimes_as_utc_aware() -> None:
    stored_time = datetime(2026, 1, 10, 5, 45)
    post = Post(
        id=1,
        store_id=1,
        title="Launch",
        caption="",
        hashtags="",
        platform="rubika",
        status="scheduled",
        timezone="Asia/Tehran",
        campaign="",
        internal_note="",
        scheduled_at=stored_time,
        rubika_message_id="",
        last_error="",
        attempt_count=0,
        created_at=stored_time,
        updated_at=stored_time,
    )

    response = post_response(post)

    assert response.scheduled_at == stored_time.replace(tzinfo=timezone.utc)
    assert response.created_at == stored_time.replace(tzinfo=timezone.utc)
    assert response.updated_at == stored_time.replace(tzinfo=timezone.utc)


def test_schedule_post_normalizes_tehran_time_and_returns_utc_response() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    tehran = timezone(timedelta(hours=3, minutes=30))
    now = datetime(2026, 1, 1, 12, 0, 0)

    with session_factory() as db:
        store = Store(name="Main", created_at=now, updated_at=now)
        db.add(store)
        db.flush()

        post = Post(store_id=store.id, title="Launch", status="draft", created_at=now, updated_at=now)
        db.add(post)
        db.add(RubikaAccount(bot_token="token", chat_id="channel", status="connected", last_test_at=datetime.utcnow()))
        db.commit()

        response = schedule_post(
            post.id,
            PostScheduleRequest(scheduled_at=datetime(2026, 1, 10, 9, 15, tzinfo=tehran), timezone="Asia/Tehran"),
            store=store,
            db=db,
        )
        db.refresh(post)

        expected_utc_naive = datetime(2026, 1, 10, 5, 45)
        assert post.status == "scheduled"
        assert post.scheduled_at == expected_utc_naive
        assert post.scheduled_at.tzinfo is None
        assert post.timezone == "Asia/Tehran"
        assert response.scheduled_at == expected_utc_naive.replace(tzinfo=timezone.utc)
        assert response.ready_at is not None


def test_schedule_post_rejects_stale_rubika_connection() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime.utcnow()

    with session_factory() as db:
        store = Store(name="Main", created_at=now, updated_at=now)
        db.add(store)
        db.flush()
        post = Post(store_id=store.id, title="Launch", status="draft", created_at=now, updated_at=now)
        db.add(post)
        db.add(RubikaAccount(bot_token="token", chat_id="channel", status="connected", last_test_at=now - timedelta(days=2)))
        db.commit()

        with pytest.raises(HTTPException, match="Rubika connection must be tested successfully"):
            schedule_post(
                post.id,
                PostScheduleRequest(scheduled_at=now + timedelta(hours=1), timezone="Asia/Tehran"),
                store=store,
                db=db,
            )

        with pytest.raises(HTTPException, match="Rubika connection must be tested successfully"):
            change_status(post.id, PostStatusRequest(status="scheduled"), store=store, db=db)

        post.status = "failed"
        db.commit()
        with pytest.raises(HTTPException, match="Rubika connection must be tested successfully"):
            retry_failed_post(post.id, store=store, db=db)


def test_schedule_post_rejects_instagram_only_until_oauth_is_connected() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime.utcnow()

    with session_factory() as db:
        store = Store(name="Main", created_at=now, updated_at=now)
        db.add(store)
        db.flush()
        post = Post(store_id=store.id, title="Launch", status="draft", platform="instagram", created_at=now, updated_at=now)
        db.add(post)
        db.add(RubikaAccount(bot_token="token", chat_id="channel", status="connected", last_test_at=now))
        db.add(InstagramAccount(store_id=store.id, username="brand", status="oauth_required", created_at=now, updated_at=now))
        db.commit()

        with pytest.raises(HTTPException, match="Instagram direct publishing requires Meta OAuth"):
            schedule_post(post.id, PostScheduleRequest(scheduled_at=now + timedelta(hours=1)), store=store, db=db)


def test_schedule_post_allows_personal_instagram_reminder_mode() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime.utcnow()

    with session_factory() as db:
        store = Store(name="Main", created_at=now, updated_at=now)
        db.add(store)
        db.flush()
        post = Post(store_id=store.id, title="Manual IG", status="draft", platform="instagram", created_at=now, updated_at=now)
        db.add(post)
        db.add(InstagramAccount(store_id=store.id, username="personal_shop", account_type="personal", publish_mode="reminder", status="reminder_ready", created_at=now, updated_at=now))
        db.commit()

        scheduled = schedule_post(post.id, PostScheduleRequest(scheduled_at=now + timedelta(hours=1)), store=store, db=db)

        assert scheduled.status == "scheduled"
        assert scheduled.platform == "instagram"


def test_mark_manual_published_completes_manual_ready_post() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime.utcnow()

    with session_factory() as db:
        store = Store(name="Main", created_at=now, updated_at=now)
        db.add(store)
        db.flush()
        post = Post(store_id=store.id, title="Manual IG", status="manual_ready", platform="instagram", created_at=now, updated_at=now)
        db.add(post)
        db.commit()

        response = mark_manual_published(post.id, store=store, db=db)

        assert response.status == "published"
        assert response.published_at is not None
        assert post.status == "published"
        assert post.last_error == ""


def test_schedule_post_allows_mixed_channels_when_rubika_is_ready() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime.utcnow()

    with session_factory() as db:
        store = Store(name="Main", created_at=now, updated_at=now)
        db.add(store)
        db.flush()
        post = Post(store_id=store.id, title="Launch", status="draft", platform="rubika,instagram", created_at=now, updated_at=now)
        db.add(post)
        db.add(RubikaAccount(bot_token="token", chat_id="channel", status="connected", last_test_at=now))
        db.commit()

        scheduled = schedule_post(post.id, PostScheduleRequest(scheduled_at=now + timedelta(hours=1)), store=store, db=db)

        assert scheduled.status == "scheduled"
        assert scheduled.platform == "rubika,instagram"


def test_review_workflow_controls_scheduling() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime.utcnow()

    with session_factory() as db:
        store = Store(name="Main", created_at=now, updated_at=now)
        reviewer = User(email="reviewer@example.com", full_name="Reviewer", password_hash="hash", created_at=now)
        db.add_all([store, reviewer])
        db.flush()
        post = Post(store_id=store.id, title="Review me", status="draft", created_at=now, updated_at=now)
        db.add(post)
        db.add(RubikaAccount(bot_token="token", chat_id="channel", status="connected", last_test_at=now))
        db.commit()

        submitted = submit_post_for_review(post.id, PostReviewRequest(note="Please review"), store=store, db=db)

        assert submitted.approval_status == "pending"
        assert submitted.approval_note == "Please review"
        assert submitted.submitted_at is not None
        assert post.status == "ready"

        with pytest.raises(HTTPException, match="Post must be approved before scheduling"):
            schedule_post(post.id, PostScheduleRequest(scheduled_at=now + timedelta(hours=1)), store=store, db=db)

        changes = request_post_changes(post.id, PostReviewRequest(note="Add image"), store=store, db=db, current_user=reviewer)

        assert changes.approval_status == "changes_requested"
        assert changes.approval_note == "Add image"
        assert changes.reviewed_by == "Reviewer"
        assert post.status == "draft"

        submit_post_for_review(post.id, PostReviewRequest(note="Updated"), store=store, db=db)
        approved = approve_post(post.id, PostReviewRequest(note="Looks good"), store=store, db=db, current_user=reviewer)

        assert approved.approval_status == "approved"
        assert approved.reviewed_at is not None
        assert approved.reviewed_by == "Reviewer"

        scheduled = schedule_post(post.id, PostScheduleRequest(scheduled_at=now + timedelta(hours=1)), store=store, db=db)

        assert scheduled.status == "scheduled"


def test_retry_all_failed_posts_requeues_current_store_only() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime.utcnow()

    with session_factory() as db:
        current_store = Store(name="Main", created_at=now, updated_at=now)
        other_store = Store(name="Other", created_at=now, updated_at=now)
        db.add_all([current_store, other_store])
        db.flush()
        first = Post(store_id=current_store.id, title="First", status="failed", last_error="Timeout", failed_at=now, created_at=now, updated_at=now)
        second = Post(store_id=current_store.id, title="Second", status="failed", last_error="Missing file", failed_at=now, created_at=now, updated_at=now)
        other = Post(store_id=other_store.id, title="Other", status="failed", last_error="Other error", failed_at=now, created_at=now, updated_at=now)
        db.add_all([first, second, other])
        db.add(RubikaAccount(bot_token="token", chat_id="channel", status="connected", last_test_at=now))
        db.commit()

        response = retry_all_failed_posts(store=current_store, db=db)

        assert response.retried_count == 2
        assert response.post_ids == [first.id, second.id]
        assert first.status == "scheduled"
        assert second.status == "scheduled"
        assert first.last_error == ""
        assert second.failed_at is None
        assert other.status == "failed"


def test_bulk_change_status_updates_eligible_current_store_posts_and_reports_skips() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime.utcnow()

    with session_factory() as db:
        current_store = Store(name="Main", created_at=now, updated_at=now)
        other_store = Store(name="Other", created_at=now, updated_at=now)
        db.add_all([current_store, other_store])
        db.flush()
        draft = Post(store_id=current_store.id, title="Draft", status="draft", created_at=now, updated_at=now)
        failed = Post(store_id=current_store.id, title="Failed", status="failed", last_error="Timeout", created_at=now, updated_at=now)
        published = Post(store_id=current_store.id, title="Published", status="published", created_at=now, updated_at=now)
        other = Post(store_id=other_store.id, title="Other", status="draft", created_at=now, updated_at=now)
        db.add_all([draft, failed, published, other])
        db.commit()

        response = bulk_change_status(
            BulkPostStatusRequest(post_ids=[draft.id, failed.id, published.id, other.id, draft.id], status="ready"),
            store=current_store,
            db=db,
        )

        assert response.updated_count == 2
        assert response.post_ids == [draft.id, failed.id]
        assert response.skipped_post_ids == [published.id, other.id]
        assert draft.status == "ready"
        assert failed.status == "ready"
        assert failed.last_error == ""
        assert published.status == "published"
        assert other.status == "draft"


def test_bulk_change_status_rejects_unsafe_transition() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime.utcnow()

    with session_factory() as db:
        store = Store(name="Main", created_at=now, updated_at=now)
        db.add(store)
        db.commit()

        with pytest.raises(HTTPException, match="Bulk status only supports ready or cancelled"):
            bulk_change_status(BulkPostStatusRequest(post_ids=[], status="published"), store=store, db=db)


def test_bulk_assign_campaign_updates_current_store_posts_and_reports_skips() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime.utcnow()

    with session_factory() as db:
        current_store = Store(name="Main", created_at=now, updated_at=now)
        other_store = Store(name="Other", created_at=now, updated_at=now)
        db.add_all([current_store, other_store])
        db.flush()
        campaign = Campaign(store_id=current_store.id, name="Launch", color="#0F766E", status="active", created_at=now, updated_at=now)
        current_post = Post(store_id=current_store.id, title="Current", status="published", campaign="", created_at=now, updated_at=now)
        second_post = Post(store_id=current_store.id, title="Second", status="draft", campaign="", created_at=now, updated_at=now)
        other_post = Post(store_id=other_store.id, title="Other", status="draft", campaign="", created_at=now, updated_at=now)
        db.add_all([campaign, current_post, second_post, other_post])
        db.commit()

        response = bulk_assign_campaign(
            BulkPostCampaignRequest(post_ids=[current_post.id, second_post.id, other_post.id, current_post.id], campaign_id=campaign.id),
            store=current_store,
            db=db,
        )

        assert response.updated_count == 2
        assert response.post_ids == [current_post.id, second_post.id]
        assert response.skipped_post_ids == [other_post.id]
        assert current_post.campaign_id == campaign.id
        assert current_post.campaign == "Launch"
        assert second_post.campaign_id == campaign.id
        assert other_post.campaign_id is None

        remove_response = bulk_assign_campaign(
            BulkPostCampaignRequest(post_ids=[current_post.id], campaign_id=None),
            store=current_store,
            db=db,
        )

        assert remove_response.updated_count == 1
        assert current_post.campaign_id is None
        assert current_post.campaign == ""


def test_bulk_assign_campaign_rejects_other_store_campaign() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime.utcnow()

    with session_factory() as db:
        current_store = Store(name="Main", created_at=now, updated_at=now)
        other_store = Store(name="Other", created_at=now, updated_at=now)
        db.add_all([current_store, other_store])
        db.flush()
        campaign = Campaign(store_id=other_store.id, name="Other campaign", color="#0F766E", status="active", created_at=now, updated_at=now)
        db.add(campaign)
        db.commit()

        with pytest.raises(HTTPException, match="Campaign not found for active store"):
            bulk_assign_campaign(BulkPostCampaignRequest(post_ids=[], campaign_id=campaign.id), store=current_store, db=db)


def test_literal_bulk_routes_are_registered_before_dynamic_post_route() -> None:
    paths = [route.path for route in router.routes]

    assert paths.index("/posts/retry-failed") < paths.index("/posts/{post_id}")
    assert paths.index("/posts/bulk-status") < paths.index("/posts/{post_id}")
    assert paths.index("/posts/bulk-campaign") < paths.index("/posts/{post_id}")
