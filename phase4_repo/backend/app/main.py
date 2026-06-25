from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import SessionLocal, check_database
from app.migrations import run_migrations
from app.routes.auth import router as auth_router
from app.routes.campaigns import router as campaigns_router
from app.routes.channels import router as channels_router
from app.routes.instagram import router as instagram_router
from app.routes.media import router as media_router
from app.routes.notifications import router as notifications_router
from app.routes.posts import router as posts_router
from app.routes.publish_attempts import router as publish_attempts_router
from app.routes.rubika import router as rubika_router
from app.routes.stores import router as stores_router
from app.seed import seed_admin_user

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

for router in [auth_router, stores_router, rubika_router, instagram_router, channels_router, campaigns_router, posts_router, media_router, publish_attempts_router, notifications_router]:
    app.include_router(router)


@app.on_event("startup")
def on_startup() -> None:
    run_migrations()
    with SessionLocal() as db:
        seed_admin_user(db)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "backend", "app": settings.app_name, "environment": settings.app_env}


@app.get("/health/db", tags=["system"])
def database_health() -> dict[str, str]:
    check_database()
    return {"status": "ok", "database": "connected"}
