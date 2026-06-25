"""Add store brand kit fields.

Revision ID: 20260601_0003
Revises: 20260531_0002
Create Date: 2026-06-01
"""

from alembic import op
import sqlalchemy as sa

revision = "20260601_0003"
down_revision = "20260531_0002"
branch_labels = None
depends_on = None


def column_names(table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)}


def add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if column.name not in column_names(table_name):
        op.add_column(table_name, column)


def upgrade() -> None:
    add_column_if_missing("stores", sa.Column("logo_asset_id", sa.Integer(), nullable=True))
    add_column_if_missing("stores", sa.Column("avatar_asset_id", sa.Integer(), nullable=True))
    add_column_if_missing("stores", sa.Column("brand_primary_color", sa.String(length=32), server_default="#0F766E", nullable=False))
    add_column_if_missing("stores", sa.Column("brand_accent_color", sa.String(length=32), server_default="#2563EB", nullable=False))
    add_column_if_missing("stores", sa.Column("brand_voice", sa.Text(), server_default="", nullable=False))
    add_column_if_missing("stores", sa.Column("default_cta", sa.Text(), server_default="", nullable=False))
    add_column_if_missing("stores", sa.Column("content_guidelines", sa.Text(), server_default="", nullable=False))


def downgrade() -> None:
    columns = column_names("stores")
    for name in ["avatar_asset_id", "logo_asset_id", "content_guidelines", "default_cta", "brand_voice", "brand_accent_color", "brand_primary_color"]:
        if name in columns:
            op.drop_column("stores", name)
