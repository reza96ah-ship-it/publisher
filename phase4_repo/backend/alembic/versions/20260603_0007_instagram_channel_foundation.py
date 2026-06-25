"""Add Instagram channel foundation.

Revision ID: 20260603_0007
Revises: 20260602_0006
Create Date: 2026-06-03
"""

from alembic import op
import sqlalchemy as sa

revision = "20260603_0007"
down_revision = "20260602_0006"
branch_labels = None
depends_on = None


def table_exists(table_name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table_name)


def index_exists(table_name: str, index_name: str) -> bool:
    if not table_exists(table_name):
        return False
    return any(index["name"] == index_name for index in sa.inspect(op.get_bind()).get_indexes(table_name))


def create_index_if_missing(index_name: str, table_name: str, columns: list[str]) -> None:
    if not index_exists(table_name, index_name):
        op.create_index(index_name, table_name, columns)


def upgrade() -> None:
    if not table_exists("instagram_accounts"):
        op.create_table(
            "instagram_accounts",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("store_id", sa.Integer(), nullable=False),
            sa.Column("username", sa.String(length=255), server_default="", nullable=False),
            sa.Column("professional_account_id", sa.String(length=255), server_default="", nullable=False),
            sa.Column("page_id", sa.String(length=255), server_default="", nullable=False),
            sa.Column("status", sa.String(length=64), server_default="oauth_required", nullable=False),
            sa.Column("permissions", sa.Text(), server_default="", nullable=False),
            sa.Column("last_error", sa.Text(), server_default="", nullable=False),
            sa.Column("last_test_at", sa.DateTime(), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["store_id"], ["stores.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    create_index_if_missing("ix_instagram_accounts_store_id", "instagram_accounts", ["store_id"])
    create_index_if_missing("ix_instagram_accounts_status", "instagram_accounts", ["status"])


def downgrade() -> None:
    if table_exists("instagram_accounts"):
        op.drop_table("instagram_accounts")
