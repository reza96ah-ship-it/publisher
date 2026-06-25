"""Add store brand asset references.

Revision ID: 20260602_0004
Revises: 20260601_0003
Create Date: 2026-06-02
"""

from alembic import op
import sqlalchemy as sa

revision = "20260602_0004"
down_revision = "20260601_0003"
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


def downgrade() -> None:
    columns = column_names("stores")
    for name in ["avatar_asset_id", "logo_asset_id"]:
        if name in columns:
            op.drop_column("stores", name)
