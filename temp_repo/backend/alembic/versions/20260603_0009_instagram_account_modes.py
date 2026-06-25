"""Add Instagram account type and publish mode.

Revision ID: 20260603_0009
Revises: 20260603_0008
Create Date: 2026-06-03
"""

from alembic import op
import sqlalchemy as sa

revision = "20260603_0009"
down_revision = "20260603_0008"
branch_labels = None
depends_on = None


def table_exists(table_name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table_name)


def column_names(table_name: str) -> set[str]:
    if not table_exists(table_name):
        return set()
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)}


def upgrade() -> None:
    columns = column_names("instagram_accounts")
    if "account_type" not in columns:
        op.add_column("instagram_accounts", sa.Column("account_type", sa.String(length=64), server_default="creator", nullable=False))
    if "publish_mode" not in columns:
        op.add_column("instagram_accounts", sa.Column("publish_mode", sa.String(length=64), server_default="direct", nullable=False))


def downgrade() -> None:
    columns = column_names("instagram_accounts")
    if "publish_mode" in columns:
        op.drop_column("instagram_accounts", "publish_mode")
    if "account_type" in columns:
        op.drop_column("instagram_accounts", "account_type")
