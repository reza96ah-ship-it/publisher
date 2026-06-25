"""Add campaign OS foundation.

Revision ID: 20260602_0005
Revises: 20260602_0004
Create Date: 2026-06-02
"""

from alembic import op
import sqlalchemy as sa

revision = "20260602_0005"
down_revision = "20260602_0004"
branch_labels = None
depends_on = None


def table_exists(table_name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table_name)


def column_names(table_name: str) -> set[str]:
    if not table_exists(table_name):
        return set()
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)}


def index_exists(table_name: str, index_name: str) -> bool:
    if not table_exists(table_name):
        return False
    return any(index["name"] == index_name for index in sa.inspect(op.get_bind()).get_indexes(table_name))


def create_index_if_missing(index_name: str, table_name: str, columns: list[str], unique: bool = False) -> None:
    if not index_exists(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if column.name not in column_names(table_name):
        op.add_column(table_name, column)


def upgrade() -> None:
    if not table_exists("campaigns"):
        op.create_table(
            "campaigns",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("store_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("goal", sa.Text(), server_default="", nullable=False),
            sa.Column("status", sa.String(length=64), server_default="active", nullable=False),
            sa.Column("color", sa.String(length=32), server_default="#0F766E", nullable=False),
            sa.Column("owner", sa.String(length=255), server_default="", nullable=False),
            sa.Column("starts_at", sa.DateTime(), nullable=True),
            sa.Column("ends_at", sa.DateTime(), nullable=True),
            sa.Column("notes", sa.Text(), server_default="", nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["store_id"], ["stores.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    create_index_if_missing("ix_campaigns_id", "campaigns", ["id"])
    create_index_if_missing("ix_campaigns_store_id", "campaigns", ["store_id"])
    create_index_if_missing("ix_campaigns_status", "campaigns", ["status"])
    create_index_if_missing("ix_campaigns_starts_at", "campaigns", ["starts_at"])
    create_index_if_missing("ix_campaigns_ends_at", "campaigns", ["ends_at"])

    add_column_if_missing("posts", sa.Column("campaign_id", sa.Integer(), nullable=True))
    create_index_if_missing("ix_posts_campaign_id", "posts", ["campaign_id"])
    backfill_campaigns()


def backfill_campaigns() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT store_id, campaign
            FROM posts
            WHERE campaign IS NOT NULL AND trim(campaign) <> ''
            GROUP BY store_id, campaign
            """
        )
    ).all()
    for store_id, campaign_name in rows:
        campaign_id = bind.execute(
            sa.text(
                """
                SELECT id FROM campaigns
                WHERE store_id = :store_id AND name = :name
                ORDER BY id ASC
                LIMIT 1
                """
            ),
            {"store_id": store_id, "name": campaign_name},
        ).scalar()
        if campaign_id is None:
            campaign_id = bind.execute(
                sa.text(
                    """
                    INSERT INTO campaigns (store_id, name, goal, status, color, owner, starts_at, ends_at, notes, created_at, updated_at)
                    VALUES (:store_id, :name, '', 'active', '#0F766E', '', NULL, NULL, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id
                    """
                ),
                {"store_id": store_id, "name": campaign_name},
            ).scalar_one()
        bind.execute(
            sa.text(
                """
                UPDATE posts
                SET campaign_id = :campaign_id
                WHERE store_id = :store_id AND campaign = :name AND campaign_id IS NULL
                """
            ),
            {"campaign_id": campaign_id, "store_id": store_id, "name": campaign_name},
        )


def downgrade() -> None:
    columns = column_names("posts")
    if "campaign_id" in columns:
        op.drop_index("ix_posts_campaign_id", table_name="posts")
        op.drop_column("posts", "campaign_id")
    if table_exists("campaigns"):
        op.drop_table("campaigns")
