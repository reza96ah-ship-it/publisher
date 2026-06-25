from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import InstagramAccount, RubikaAccount, Store, User
from app.routes.channels import list_channel_accounts


def test_channel_accounts_sync_rubika_and_manual_instagram() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime.utcnow()

    with session_factory() as db:
        store = Store(name="Main", created_at=now, updated_at=now)
        db.add(store)
        db.flush()
        db.add(RubikaAccount(bot_token="token", chat_id="channel", bot_name="Store Bot", status="connected", last_test_at=now))
        db.add(InstagramAccount(store_id=store.id, username="shop", account_type="personal", publish_mode="reminder", status="reminder_ready", created_at=now, updated_at=now))
        db.commit()

        response = list_channel_accounts(
            store=store,
            current_user=User(email="admin@example.com", password_hash="hash", full_name="Admin"),
            db=db,
        )

        assert response.summary.total == 2
        assert response.summary.ready == 2
        rubika = next(account for account in response.accounts if account.channel == "rubika")
        instagram = next(account for account in response.accounts if account.channel == "instagram")
        assert rubika.status == "ready"
        assert rubika.mode == "rubika_bot"
        assert "auto_publish" in rubika.capabilities
        assert instagram.status == "ready"
        assert instagram.mode == "instagram_personal_manual"
        assert "manual_publish" in instagram.capabilities


def test_channel_accounts_create_default_action_required_channels() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime.utcnow()

    with session_factory() as db:
        store = Store(name="Main", created_at=now, updated_at=now)
        db.add(store)
        db.commit()

        response = list_channel_accounts(
            store=store,
            current_user=User(email="admin@example.com", password_hash="hash", full_name="Admin"),
            db=db,
        )

        assert response.summary.total == 2
        assert response.summary.ready == 0
        assert response.summary.action_required == 2
        assert {account.channel for account in response.accounts} == {"rubika", "instagram"}
        assert all(account.status == "not_configured" for account in response.accounts)
