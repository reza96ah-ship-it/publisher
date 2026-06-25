from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.dependencies import get_active_store
from app.models import Store, User
from app.schemas import ChannelAccountListResponse, ChannelAccountResponse, ChannelAccountSummaryResponse
from app.services.channel_accounts import account_response, sync_channel_accounts

router = APIRouter(prefix="/channels", tags=["channels"])


def is_ready(account: ChannelAccountResponse) -> bool:
    return account.status == "ready"


@router.get("/accounts", response_model=ChannelAccountListResponse)
def list_channel_accounts(
    store: Store = Depends(get_active_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChannelAccountListResponse:
    accounts = [account_response(account) for account in sync_channel_accounts(db, store)]
    return ChannelAccountListResponse(
        accounts=accounts,
        summary=ChannelAccountSummaryResponse(
            total=len(accounts),
            ready=sum(1 for account in accounts if is_ready(account)),
            action_required=sum(1 for account in accounts if not is_ready(account)),
            channels=[account.channel for account in accounts],
        ),
    )
