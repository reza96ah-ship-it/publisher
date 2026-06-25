"""Add token fields for Instagram delivery.

Revision ID: 20260618_0012
Revises: 20260618_0011
Create Date: 2026-06-18 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260618_0012"
down_revision = "20260618_0011"
branch_labels = None
depends_on = None


def column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    columns = column_names("instagram_accounts")
    if "access_token" not in columns:
        op.add_column("instagram_accounts", sa.Column("access_token", sa.Text(), server_default="", nullable=False))
    if "token_expires_at" not in columns:
        op.add_column("instagram_accounts", sa.Column("token_expires_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    columns = column_names("instagram_accounts")
    if "token_expires_at" in columns:
        op.drop_column("instagram_accounts", "token_expires_at")
    if "access_token" in columns:
        op.drop_column("instagram_accounts", "access_token")
