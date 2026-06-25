from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import User
from app.security import hash_password

settings = get_settings()


def seed_admin_user(db: Session) -> None:
    existing_user = db.scalar(select(User).where(User.email == settings.admin_email))
    if existing_user:
        return

    user = User(
        email=settings.admin_email,
        password_hash=hash_password(settings.admin_password),
        full_name="مدیر سیستم",
        is_active=True,
    )
    db.add(user)
    db.commit()
