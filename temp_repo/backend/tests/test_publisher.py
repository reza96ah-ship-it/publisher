import json
from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import InstagramAccount, MediaAsset, Post, PublishAttempt, RubikaAccount
from app.services.publisher import build_post_text, extract_file_id, extract_message_id, extract_upload_url, json_text
from app.services.publisher import publish_post
from app.services.publisher import recover_stale_publishing_posts, reserve_due_posts, rubika_response_error


class PostStub:
    def __init__(self, title: str = "", caption: str = "", hashtags: str = "") -> None:
        self.title = title
        self.caption = caption
        self.hashtags = hashtags


def test_build_post_text_combines_caption_and_hashtags() -> None:
    post = PostStub(caption="A launch caption", hashtags="#rubika #shop")

    assert build_post_text(post) == "A launch caption\n\n#rubika #shop"


def test_build_post_text_falls_back_to_title() -> None:
    post = PostStub(title="Internal title")

    assert build_post_text(post) == "Internal title"


def test_build_post_text_has_default_empty_message() -> None:
    post = PostStub()

    assert build_post_text(post) == "پست بدون متن"


def test_extract_message_id_checks_nested_and_top_level_fields() -> None:
    assert extract_message_id({"data": {"message_id": 123}}) == "123"
    assert extract_message_id({"messageId": "abc"}) == "abc"
    assert extract_message_id({"data": {"id": "nested-id"}}) == "nested-id"
    assert extract_message_id({"send": {"data": {"message_id": "sent-media"}}}) == "sent-media"


def test_extract_upload_metadata_checks_nested_and_top_level_fields() -> None:
    assert extract_upload_url({"data": {"upload_url": "https://upload.example/file"}}) == "https://upload.example/file"
    assert extract_upload_url({"result": {"uploadUrl": "https://upload.example/camel"}}) == "https://upload.example/camel"
    assert extract_file_id({"data": {"file_id": "file-123"}}) == "file-123"
    assert extract_file_id({"file": {"fileId": "file-456"}}) == "file-456"


def test_rubika_response_error_accepts_success_shapes() -> None:
    assert rubika_response_error({"status": "OK", "data": {"message_id": 123}}) == ""
    assert rubika_response_error({"ok": True, "result": {"id": "abc"}}) == ""
    assert rubika_response_error({"ok": True, "message": "Sent"}) == ""
    assert rubika_response_error({"data": {"id": "nested-id"}}) == ""


def test_rubika_response_error_rejects_error_shapes() -> None:
    assert rubika_response_error({"ok": False}) == "Rubika returned ok=false"
    assert rubika_response_error({"status": "ERROR", "description": "Invalid chat"}) == "Invalid chat"
    assert rubika_response_error({"error_message": "Invalid token"}) == "Invalid token"
    assert rubika_response_error({"data": {"error": "Chat not found"}}) == "Chat not found"


def test_json_text_keeps_persian_text_readable() -> None:
    assert json_text({"text": "سلام"}) == '{"text": "سلام"}'


def test_reserve_due_posts_claims_only_due_scheduled_posts() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime(2026, 1, 1, 12, 0, 0)

    with session_factory() as db:
        due_post = Post(store_id=1, title="Due", status="scheduled", scheduled_at=now - timedelta(minutes=1), created_at=now, updated_at=now)
        future_post = Post(store_id=1, title="Future", status="scheduled", scheduled_at=now + timedelta(minutes=1), created_at=now, updated_at=now)
        draft_post = Post(store_id=1, title="Draft", status="draft", scheduled_at=now - timedelta(minutes=1), created_at=now, updated_at=now)
        db.add_all([due_post, future_post, draft_post])
        db.commit()

        reserved = reserve_due_posts(db, now, limit=10)

        assert [post.id for post in reserved] == [due_post.id]
        assert due_post.status == "publishing"
        assert future_post.status == "scheduled"
        assert draft_post.status == "draft"

        assert reserve_due_posts(db, now, limit=10) == []


def test_recover_stale_publishing_posts_marks_only_old_claims_failed() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime(2026, 1, 1, 12, 0, 0)

    with session_factory() as db:
        stale_post = Post(store_id=1, title="Stale", status="publishing", scheduled_at=now, created_at=now, updated_at=now - timedelta(minutes=30))
        fresh_post = Post(store_id=1, title="Fresh", status="publishing", scheduled_at=now, created_at=now, updated_at=now - timedelta(minutes=2))
        db.add_all([stale_post, fresh_post])
        db.commit()

        recovered_count = recover_stale_publishing_posts(db, now, stale_after_minutes=15)

        assert recovered_count == 1
        assert stale_post.status == "failed"
        assert stale_post.failed_at == now
        assert stale_post.last_error == "Publishing timed out before worker completed"
        assert fresh_post.status == "publishing"


def test_publish_post_sends_attached_media(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime(2026, 1, 1, 12, 0, 0)
    media_path = tmp_path / "photo.jpg"
    media_path.write_bytes(b"fake-image")
    calls: list[tuple] = []

    class FakeRubikaClient:
        def __init__(self, token: str) -> None:
            calls.append(("init", token))

        async def request_send_file(self, file_type: str) -> dict:
            calls.append(("request_send_file", file_type))
            return {"status": "OK", "data": {"upload_url": "https://upload.example/file"}}

        async def upload_file(self, upload_url: str, file_path: str, content_type: str, filename: str) -> dict:
            calls.append(("upload_file", upload_url, file_path, content_type, filename))
            return {"status": "OK", "data": {"file_id": "file-123"}}

        async def send_file(self, chat_id: str, file_id: str, text: str = "") -> dict:
            calls.append(("send_file", chat_id, file_id, text))
            return {"status": "OK", "data": {"message_id": "msg-123"}}

    monkeypatch.setattr("app.services.publisher.RubikaClient", FakeRubikaClient)

    with session_factory() as db:
        db.add(RubikaAccount(bot_token="token-123", chat_id="chat-123"))
        post = Post(store_id=1, title="Launch", caption="Caption", hashtags="#tag", status="publishing", created_at=now, updated_at=now)
        db.add(post)
        db.flush()
        asset = MediaAsset(
            store_id=1,
            post_id=post.id,
            original_filename="photo.jpg",
            stored_filename="photo.jpg",
            file_path=str(media_path),
            content_type="image/jpeg",
            size_bytes=media_path.stat().st_size,
            created_at=now,
        )
        db.add(asset)
        db.commit()

        result = publish_post(db, post, action="scheduled")
        attempt = db.scalar(select(PublishAttempt).where(PublishAttempt.post_id == post.id))

        assert result == {
            "ok": True,
            "post_id": post.id,
            "status": "published",
            "channels": [{"ok": True, "post_id": post.id, "channel": "rubika", "message_id": "msg-123", "media_asset_id": asset.id}],
        }
        assert post.status == "published"
        assert post.rubika_message_id == "msg-123"
        assert calls == [
            ("init", "token-123"),
            ("request_send_file", "Image"),
            ("upload_file", "https://upload.example/file", str(media_path), "image/jpeg", "photo.jpg"),
            ("send_file", "chat-123", "file-123", "Caption\n\n#tag"),
        ]
        assert attempt is not None
        assert attempt.channel == "rubika"
        assert json.loads(attempt.request_payload)["mode"] == "media"
        assert json.loads(attempt.response_payload)["file_id"] == "file-123"


def test_publish_post_falls_back_to_text_without_media(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime(2026, 1, 1, 12, 0, 0)
    calls: list[tuple] = []

    class FakeRubikaClient:
        def __init__(self, token: str) -> None:
            calls.append(("init", token))

        async def send_message(self, chat_id: str, text: str) -> dict:
            calls.append(("send_message", chat_id, text))
            return {"status": "OK", "data": {"message_id": "msg-text"}}

    monkeypatch.setattr("app.services.publisher.RubikaClient", FakeRubikaClient)

    with session_factory() as db:
        db.add(RubikaAccount(bot_token="token-123", chat_id="chat-123"))
        post = Post(store_id=1, title="Text only", caption="Caption", hashtags="", status="publishing", created_at=now, updated_at=now)
        db.add(post)
        db.commit()

        result = publish_post(db, post, action="scheduled")

        assert result == {
            "ok": True,
            "post_id": post.id,
            "status": "published",
            "channels": [{"ok": True, "post_id": post.id, "channel": "rubika", "message_id": "msg-text"}],
        }
        assert post.status == "published"
        assert post.rubika_message_id == "msg-text"
        assert calls == [("init", "token-123"), ("send_message", "chat-123", "Caption")]


def test_publish_post_fails_when_attached_media_file_is_missing() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime(2026, 1, 1, 12, 0, 0)

    with session_factory() as db:
        db.add(RubikaAccount(bot_token="token-123", chat_id="chat-123"))
        post = Post(store_id=1, title="Missing media", status="publishing", created_at=now, updated_at=now)
        db.add(post)
        db.flush()
        db.add(
            MediaAsset(
                store_id=1,
                post_id=post.id,
                original_filename="missing.jpg",
                stored_filename="missing.jpg",
                file_path="/tmp/does-not-exist.jpg",
                content_type="image/jpeg",
                size_bytes=10,
                created_at=now,
            )
        )
        db.commit()

        result = publish_post(db, post, action="scheduled")
        attempt = db.scalar(select(PublishAttempt).where(PublishAttempt.post_id == post.id))

        assert result == {
            "ok": False,
            "post_id": post.id,
            "status": "failed",
            "channels": [{"ok": False, "post_id": post.id, "channel": "rubika", "error": "Attached media file is missing"}],
        }
        assert post.status == "failed"
        assert post.last_error == "Attached media file is missing"
        assert attempt is not None
        assert attempt.channel == "rubika"
        assert json.loads(attempt.request_payload)["mode"] == "media"


def test_publish_post_keeps_rubika_success_when_instagram_is_not_connected(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime(2026, 1, 1, 12, 0, 0)
    calls: list[tuple] = []

    class FakeRubikaClient:
        def __init__(self, token: str) -> None:
            calls.append(("init", token))

        async def send_message(self, chat_id: str, text: str) -> dict:
            calls.append(("send_message", chat_id, text))
            return {"status": "OK", "data": {"message_id": "msg-rubika"}}

    monkeypatch.setattr("app.services.publisher.RubikaClient", FakeRubikaClient)

    with session_factory() as db:
        db.add(RubikaAccount(bot_token="token-123", chat_id="chat-123"))
        post = Post(
            store_id=1,
            title="Multi channel",
            caption="Caption",
            platform="rubika,instagram",
            status="publishing",
            created_at=now,
            updated_at=now,
        )
        db.add(post)
        db.commit()

        result = publish_post(db, post, action="scheduled")
        attempts = db.scalars(select(PublishAttempt).where(PublishAttempt.post_id == post.id).order_by(PublishAttempt.id.asc())).all()

        assert result["ok"] is False
        assert result["status"] == "partially_published"
        assert post.status == "partially_published"
        assert post.rubika_message_id == "msg-rubika"
        assert "Instagram publishing requires Meta OAuth" in post.last_error
        assert [attempt.channel for attempt in attempts] == ["rubika", "instagram"]
        assert [attempt.status for attempt in attempts] == ["success", "failed"]
        assert json.loads(attempts[1].request_payload)["mode"] == "placeholder"
        assert calls == [("init", "token-123"), ("send_message", "chat-123", "Caption")]


def test_publish_post_creates_manual_ready_for_personal_instagram_reminder() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime(2026, 1, 1, 12, 0, 0)

    with session_factory() as db:
        db.add(InstagramAccount(store_id=1, username="personal_shop", account_type="personal", publish_mode="reminder", status="reminder_ready", created_at=now, updated_at=now))
        post = Post(store_id=1, title="Manual IG", caption="Caption", platform="instagram", status="publishing", created_at=now, updated_at=now)
        db.add(post)
        db.commit()

        result = publish_post(db, post, action="scheduled")
        attempt = db.scalar(select(PublishAttempt).where(PublishAttempt.post_id == post.id))

        assert result == {
            "ok": True,
            "post_id": post.id,
            "status": "manual_ready",
            "channels": [{"ok": True, "post_id": post.id, "channel": "instagram", "manual": True, "mode": "reminder"}],
        }
        assert post.status == "manual_ready"
        assert post.published_at is None
        assert attempt is not None
        assert attempt.channel == "instagram"
        assert attempt.status == "reminder"
        assert json.loads(attempt.request_payload)["mode"] == "reminder"
