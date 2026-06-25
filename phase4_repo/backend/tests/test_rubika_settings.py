import asyncio
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import RubikaAccount, User
from app.routes.rubika import save_settings, test_connection as run_connection_test
from app.schemas import RubikaSettingsRequest


def test_save_settings_preserves_existing_token_when_blank() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime(2026, 1, 1, 12, 0, 0)

    with session_factory() as db:
        account = RubikaAccount(
            bot_token="secret-token",
            chat_id="old-channel",
            status="connected",
            created_at=now,
            updated_at=now,
        )
        db.add(account)
        db.commit()

        response = save_settings(
            RubikaSettingsRequest(bot_token="", chat_id="new-channel"),
            current_user=User(email="admin@example.com", password_hash="hash", full_name="Admin"),
            db=db,
        )
        db.refresh(account)

        assert account.bot_token == "secret-token"
        assert account.chat_id == "new-channel"
        assert account.status == "not_tested"
        assert response.chat_id == "new-channel"


def test_connection_requires_destination() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime(2026, 1, 1, 12, 0, 0)

    with session_factory() as db:
        account = RubikaAccount(
            bot_token="secret-token",
            chat_id="",
            status="not_tested",
            created_at=now,
            updated_at=now,
        )
        db.add(account)
        db.commit()

        response = asyncio.run(
            run_connection_test(
                current_user=User(email="admin@example.com", password_hash="hash", full_name="Admin"),
                db=db,
            )
        )
        db.refresh(account)

        assert response.ok is False
        assert response.status == "missing_settings"
        assert response.error == "Rubika destination is missing"
        assert account.status == "missing_settings"
