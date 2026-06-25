"""Add channel account abstraction.

Revision ID: 20260603_0010
Revises: 20260603_0009
Create Date: 2026-06-03
"""

from alembic import op
import sqlalchemy as sa

revision = "20260603_0010"
down_revision = "20260603_0009"
branch_labels = None
depends_on = None


def table_exists(table_name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table_name)


def upgrade() -> None:
    if table_exists("channel_accounts"):
        return

    op.create_table(
        "channel_accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("store_id", sa.Integer(), nullable=False),
        sa.Column("channel", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=255), server_default="", nullable=False),
        sa.Column("external_account_id", sa.String(length=255), server_default="", nullable=False),
        sa.Column("mode", sa.String(length=64), server_default="disconnected", nullable=False),
        sa.Column("status", sa.String(length=64), server_default="not_configured", nullable=False),
        sa.Column("capabilities", sa.Text(), server_default="[]", nullable=False),
        sa.Column("limitations", sa.Text(), server_default="[]", nullable=False),
        sa.Column("last_error", sa.Text(), server_default="", nullable=False),
        sa.Column("last_test_at", sa.DateTime(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_channel_accounts_id"), "channel_accounts", ["id"], unique=False)
    op.create_index(op.f("ix_channel_accounts_store_id"), "channel_accounts", ["store_id"], unique=False)
    op.create_index(op.f("ix_channel_accounts_channel"), "channel_accounts", ["channel"], unique=False)
    op.create_index(op.f("ix_channel_accounts_status"), "channel_accounts", ["status"], unique=False)


def downgrade() -> None:
    if not table_exists("channel_accounts"):
        return

    op.drop_index(op.f("ix_channel_accounts_status"), table_name="channel_accounts")
    op.drop_index(op.f("ix_channel_accounts_channel"), table_name="channel_accounts")
    op.drop_index(op.f("ix_channel_accounts_store_id"), table_name="channel_accounts")
    op.drop_index(op.f("ix_channel_accounts_id"), table_name="channel_accounts")
    op.drop_table("channel_accounts")
