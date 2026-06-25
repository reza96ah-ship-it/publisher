from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Post, Store
from app.routes.campaigns import create_campaign, delete_campaign, list_campaigns, read_campaign, update_campaign
from app.schemas import CampaignRequest


def test_campaign_crud_is_scoped_to_store_and_counts_posts() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime.utcnow()

    with session_factory() as db:
        store = Store(name="Main", created_at=now, updated_at=now)
        db.add(store)
        db.flush()

        created = create_campaign(
            CampaignRequest(name="Summer Launch", goal="Move seasonal stock", status="invalid", color="not-a-color", owner="Sara"),
            store=store,
            db=db,
        )

        assert created.name == "Summer Launch"
        assert created.status == "active"
        assert created.color == "#0F766E"

        updated = update_campaign(
            created.id,
            CampaignRequest(name="Summer Launch 2", goal="Updated", status="paused", color="#2563eb", owner="Reza"),
            store=store,
            db=db,
        )

        assert updated.name == "Summer Launch 2"
        assert updated.status == "paused"
        assert updated.color == "#2563EB"

        post = Post(store_id=store.id, title="Campaign post", campaign_id=created.id, campaign=updated.name, created_at=now, updated_at=now)
        db.add(post)
        db.commit()

        listed = list_campaigns(status=None, store=store, db=db)
        assert len(listed) == 1
        assert listed[0].post_count == 1
        assert read_campaign(created.id, store=store, db=db).post_count == 1

        with pytest.raises(HTTPException, match="Campaign has posts"):
            delete_campaign(created.id, store=store, db=db)


def test_campaign_delete_allows_unused_campaign() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    now = datetime.utcnow()

    with session_factory() as db:
        store = Store(name="Main", created_at=now, updated_at=now)
        db.add(store)
        db.flush()

        created = create_campaign(CampaignRequest(name="Unused"), store=store, db=db)
        deleted = delete_campaign(created.id, store=store, db=db)

        assert deleted.id == created.id
        assert list_campaigns(status=None, store=store, db=db) == []
