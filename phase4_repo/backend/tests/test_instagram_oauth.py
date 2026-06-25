from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import InstagramAccount, Store, User
from app.services.instagram_oauth import sign_payload, verify_signed_payload


def test_instagram_oauth_state_rejects_tampering() -> None:
    state = sign_payload({"store_id": 1, "user_id": 2, "exp": 9999999999}, "secret")
    assert verify_signed_payload(state, "secret")["store_id"] == 1

    with pytest.raises(ValueError, match="signature"):
        verify_signed_payload(f"{state[:-2]}xx", "secret")


def test_instagram_oauth_state_rejects_expired_payload() -> None:
    state = sign_payload({"store_id": 1, "user_id": 2, "exp": 1}, "secret")

    with pytest.raises(ValueError, match="expired"):
        verify_signed_payload(state, "secret")


def test_instagram_oauth_start_reports_missing_config(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)

    with session_factory() as db:
        store = Store(name="Main", created_at=datetime.utcnow(), updated_at=datetime.utcnow())
        user = User(email="admin@example.com", password_hash="hash", full_name="Admin")
        db.add_all([store, user])
        db.commit()
        db.refresh(store)
        db.refresh(user)

        monkeypatch.setattr(
            "app.services.instagram_oauth.get_settings",
            lambda: SimpleNamespace(meta_app_id="", meta_app_secret="", meta_oauth_redirect_uri="http://localhost/callback", meta_oauth_scope_list=["instagram_basic"], app_secret_key="secret"),
        )
        from app.routes.instagram import start_instagram_oauth

        response = start_instagram_oauth(store=store, current_user=user)

        assert response.configured is False
        assert response.missing == ["META_APP_ID", "META_APP_SECRET"]


def test_instagram_oauth_callback_connects_account(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)

    with session_factory() as db:
        store = Store(name="Main", created_at=datetime.utcnow(), updated_at=datetime.utcnow())
        user = User(email="admin@example.com", password_hash="hash", full_name="Admin")
        db.add_all([store, user])
        db.commit()
        db.refresh(store)
        db.refresh(user)

    settings = SimpleNamespace(
        meta_app_id="app-id",
        meta_app_secret="app-secret",
        meta_oauth_redirect_uri="http://localhost:8000/instagram/oauth/callback",
        meta_oauth_scope_list=["instagram_basic", "pages_show_list"],
        meta_graph_api_version="v25.0",
        frontend_public_url="http://localhost:3100",
        app_secret_key="secret",
    )
    monkeypatch.setattr("app.services.instagram_oauth.get_settings", lambda: settings)
    monkeypatch.setattr("app.routes.instagram.get_settings", lambda: settings)

    class FakeInstagramGraphClient:
        def exchange_code_for_user_token(self, app_id: str, app_secret: str, redirect_uri: str, code: str):
            return SimpleNamespace(ok=True, access_token="short-token", expires_at=None)

        def exchange_long_lived_user_token(self, app_id: str, app_secret: str, short_lived_token: str):
            return SimpleNamespace(ok=True, access_token="long-token", expires_at=datetime(2026, 1, 1, 12, 0, 0))

        def find_instagram_page_connection(self, user_access_token: str):
            return SimpleNamespace(ok=True, page_id="page-1", page_access_token="page-token", professional_account_id="ig-1", username="shop")

    monkeypatch.setattr("app.routes.instagram.InstagramGraphClient", FakeInstagramGraphClient)

    def override_db():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    try:
        state = sign_payload({"store_id": store.id, "user_id": user.id, "exp": 9999999999}, "secret")
        client = TestClient(app, follow_redirects=False)
        response = client.get(f"/instagram/oauth/callback?code=abc&state={state}")

        assert response.status_code == 302
        assert "instagram_oauth=success" in response.headers["location"]
        with session_factory() as db:
            account = db.scalar(select(InstagramAccount).where(InstagramAccount.store_id == store.id))
            assert account is not None
            assert account.status == "connected"
            assert account.page_id == "page-1"
            assert account.professional_account_id == "ig-1"
            assert account.access_token == "page-token"
    finally:
        app.dependency_overrides.clear()
