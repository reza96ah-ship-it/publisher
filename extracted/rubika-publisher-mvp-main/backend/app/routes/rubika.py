from datetime import datetime

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import RubikaAccount, User
from app.schemas import RubikaAccountResponse, RubikaSettingsRequest, RubikaTestResponse
from app.services.rubika_client import RubikaClient, extract_bot_name, mask_token

router = APIRouter(prefix="/rubika", tags=["rubika"])


def account_response(account: RubikaAccount) -> RubikaAccountResponse:
    return RubikaAccountResponse(
        id=account.id,
        chat_id=account.chat_id,
        bot_token_masked=mask_token(account.bot_token),
        bot_name=account.bot_name,
        status=account.status,
        last_error=account.last_error,
        is_active=account.is_active,
    )


def get_account(db: Session) -> RubikaAccount | None:
    return db.scalar(select(RubikaAccount).where(RubikaAccount.is_active.is_(True)).order_by(RubikaAccount.id.asc()))


@router.get("/settings")
def read_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = get_account(db)
    if account is None:
        return None
    return account_response(account)


@router.put("/settings")
def save_settings(payload: RubikaSettingsRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = get_account(db)
    if account is None:
        account = RubikaAccount()
        db.add(account)

    account.bot_token = payload.bot_token.strip()
    account.chat_id = payload.chat_id.strip()
    account.status = "not_tested"
    account.last_error = ""
    account.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(account)
    return account_response(account)


@router.post("/test", response_model=RubikaTestResponse)
async def test_connection(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> RubikaTestResponse:
    account = get_account(db)
    if account is None or not account.bot_token.strip():
        return RubikaTestResponse(ok=False, status="missing_settings", error="Rubika token is missing")

    try:
        client = RubikaClient(account.bot_token)
        payload = await client.get_me()
        bot_name = extract_bot_name(payload)
        account.bot_name = bot_name
        account.status = "connected"
        account.last_error = ""
        account.last_test_at = datetime.utcnow()
        db.commit()
        return RubikaTestResponse(ok=True, status="connected", bot_name=bot_name)
    except httpx.HTTPError as exc:
        account.status = "failed"
        account.last_error = str(exc)
        account.last_test_at = datetime.utcnow()
        db.commit()
        return RubikaTestResponse(ok=False, status="failed", error=str(exc))
