from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SocialOps Studio"
    app_env: str = "local"
    app_secret_key: str = "change_this_secret_key"

    admin_email: str = "admin@example.com"
    admin_password: str = "change_this_password"

    cors_origins: str = "http://localhost:3100,http://127.0.0.1:3100,http://localhost:3000"
    database_url: str = "postgresql+psycopg://rubika_user:change_this_db_password@postgres:5432/rubika_publisher"

    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/1"

    media_dir: str = "/app/storage/media"
    rubika_api_base_url: str = "https://botapi.rubika.ir/v3"
    meta_graph_base_url: str = "https://graph.facebook.com"
    instagram_graph_base_url: str = "https://graph.instagram.com"
    meta_graph_api_version: str = "v25.0"
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_oauth_redirect_uri: str = "http://localhost:8000/instagram/oauth/callback"
    meta_oauth_scopes: str = "instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_messages,pages_show_list,pages_read_engagement"
    frontend_public_url: str = "http://localhost:3100"
    instagram_webhook_verify_token: str = ""
    instagram_webhook_app_secret: str = ""
    instagram_automation_dispatch_enabled: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def meta_oauth_scope_list(self) -> list[str]:
        return [scope.strip() for scope in self.meta_oauth_scopes.split(",") if scope.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
