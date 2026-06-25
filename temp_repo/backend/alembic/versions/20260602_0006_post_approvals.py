"""Add post approval workflow fields.

Revision ID: 20260602_0006
Revises: 20260602_0005
Create Date: 2026-06-02
"""

from alembic import op
import sqlalchemy as sa

revision = "20260602_0006"
down_revision = "20260602_0005"
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


def add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if column.name not in column_names(table_name):
        op.add_column(table_name, column)


def create_index_if_missing(index_name: str, table_name: str, columns: list[str]) -> None:
    if not index_exists(table_name, index_name):
        op.create_index(index_name, table_name, columns)


def upgrade() -> None:
    add_column_if_missing("posts", sa.Column("approval_status", sa.String(length=64), server_default="not_required", nullable=False))
    add_column_if_missing("posts", sa.Column("approval_note", sa.Text(), server_default="", nullable=False))
    add_column_if_missing("posts", sa.Column("submitted_at", sa.DateTime(), nullable=True))
    add_column_if_missing("posts", sa.Column("reviewed_at", sa.DateTime(), nullable=True))
    add_column_if_missing("posts", sa.Column("reviewed_by", sa.String(length=255), server_default="", nullable=False))
    create_index_if_missing("ix_posts_approval_status", "posts", ["approval_status"])


def downgrade() -> None:
    columns = column_names("posts")
    if "approval_status" in columns and index_exists("posts", "ix_posts_approval_status"):
        op.drop_index("ix_posts_approval_status", table_name="posts")
    for column_name in ["reviewed_by", "reviewed_at", "submitted_at", "approval_note", "approval_status"]:
        if column_name in column_names("posts"):
            op.drop_column("posts", column_name)
