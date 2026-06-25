from fastapi import Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Store, User
from app.store_scope import require_active_store


def get_active_store(_current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Store:
    return require_active_store(db)
