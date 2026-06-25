from pathlib import Path

from alembic import command
from alembic.config import Config

from app.config import get_settings

settings = get_settings()
backend_root = Path(__file__).resolve().parents[1]


def alembic_config() -> Config:
    config = Config(str(backend_root / "alembic.ini"))
    config.set_main_option("script_location", str(backend_root / "alembic"))
    config.set_main_option("sqlalchemy.url", settings.database_url)
    return config


def run_migrations() -> None:
    command.upgrade(alembic_config(), "head")
