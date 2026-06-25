"""Add Instagram automation extensions.

Revision ID: 20260621_0013
Revises: 20260618_0012
Create Date: 2026-06-21 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260621_0013"
down_revision = "20260618_0012"
branch_labels = None
depends_on = None


def column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    # Upgrade rules table
    rules_cols = column_names("instagram_automation_rules")
    if "is_template" not in rules_cols:
        op.add_column("instagram_automation_rules", sa.Column("is_template", sa.Boolean(), server_default=sa.false(), nullable=False))
    if "on_customer_reply" not in rules_cols:
        op.add_column("instagram_automation_rules", sa.Column("on_customer_reply", sa.String(length=64), server_default="hand_off", nullable=False))
    if "waiting_reply_message" not in rules_cols:
        op.add_column("instagram_automation_rules", sa.Column("waiting_reply_message", sa.Text(), nullable=True))

    # Upgrade events table
    events_cols = column_names("instagram_automation_events")
    if "commenter_ig_scoped_id" not in events_cols:
        op.add_column("instagram_automation_events", sa.Column("commenter_ig_scoped_id", sa.String(length=255), nullable=True))
    if "conversation_status" not in events_cols:
        op.add_column("instagram_automation_events", sa.Column("conversation_status", sa.String(length=64), server_default="automated", nullable=True))
    if "automation_paused_until" not in events_cols:
        op.add_column("instagram_automation_events", sa.Column("automation_paused_until", sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Downgrade events table
    events_cols = column_names("instagram_automation_events")
    if "automation_paused_until" in events_cols:
        op.drop_column("instagram_automation_events", "automation_paused_until")
    if "conversation_status" in events_cols:
        op.drop_column("instagram_automation_events", "conversation_status")
    if "commenter_ig_scoped_id" in events_cols:
        op.drop_column("instagram_automation_events", "commenter_ig_scoped_id")

    # Downgrade rules table
    rules_cols = column_names("instagram_automation_rules")
    if "waiting_reply_message" in rules_cols:
        op.drop_column("instagram_automation_rules", "waiting_reply_message")
    if "on_customer_reply" in rules_cols:
        op.drop_column("instagram_automation_rules", "on_customer_reply")
    if "is_template" in rules_cols:
        op.drop_column("instagram_automation_rules", "is_template")
