from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Rubika Publisher MVP"
    app_env: str = "local"
    app_secret_key: str = "change_this_secret_key"

    admin_email: str = "admin@example.com"
    admin_password: str = "change_this_password"

    cors_origins: str = "http://localhost:3000"
    database_url: str = "postgresql+psycopg://rubika_user:change_this_db_password@postgres:5432/rubika_publisher"

    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/1"

    media_dir: str = "/app/storage/media"
    rubika_api_base_url: str = "https://botapi.rubika.ir/v3"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
