"""Add media library organization metadata.

Revision ID: 20260531_0002
Revises: 20260524_0001
Create Date: 2026-05-31
"""

from alembic import op
import sqlalchemy as sa

revision = "20260531_0002"
down_revision = "20260524_0001"
branch_labels = None
depends_on = None


def column_names(table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)}


def add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if column.name not in column_names(table_name):
        op.add_column(table_name, column)


def upgrade() -> None:
    add_column_if_missing("media_assets", sa.Column("folder", sa.String(length=255), server_default="", nullable=False))
    add_column_if_missing("media_assets", sa.Column("tags", sa.Text(), server_default="", nullable=False))


def downgrade() -> None:
    columns = column_names("media_assets")
    if "tags" in columns:
        op.drop_column("media_assets", "tags")
    if "folder" in columns:
        op.drop_column("media_assets", "folder")
