from datetime import datetime, timedelta

from app.models import RubikaAccount

RUBIKA_TEST_MAX_AGE = timedelta(hours=24)


def is_rubika_account_ready(account: RubikaAccount | None, now: datetime | None = None) -> bool:
    if account is None:
        return False
    if not account.bot_token.strip() or not account.chat_id.strip():
        return False
    if account.status != "connected" or account.last_test_at is None:
        return False
    return account.last_test_at >= (now or datetime.utcnow()) - RUBIKA_TEST_MAX_AGE
