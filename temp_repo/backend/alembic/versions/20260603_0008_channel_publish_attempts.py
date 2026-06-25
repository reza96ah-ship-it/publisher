"""Add per-channel publish attempts.

Revision ID: 20260603_0008
Revises: 20260603_0007
Create Date: 2026-06-03
"""

from alembic import op
import sqlalchemy as sa

revision = "20260603_0008"
down_revision = "20260603_0007"
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


def upgrade() -> None:
    if "channel" not in column_names("publish_attempts"):
        op.add_column("publish_attempts", sa.Column("channel", sa.String(length=64), server_default="rubika", nullable=False))
    if not index_exists("publish_attempts", "ix_publish_attempts_channel"):
        op.create_index("ix_publish_attempts_channel", "publish_attempts", ["channel"])


def downgrade() -> None:
    if table_exists("publish_attempts"):
        if index_exists("publish_attempts", "ix_publish_attempts_channel"):
            op.drop_index("ix_publish_attempts_channel", table_name="publish_attempts")
        if "channel" in column_names("publish_attempts"):
            op.drop_column("publish_attempts", "channel")
