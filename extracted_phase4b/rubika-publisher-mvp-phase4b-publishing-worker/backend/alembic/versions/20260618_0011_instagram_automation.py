"""Add Instagram automation rules and events.

Revision ID: 20260618_0011
Revises: 20260603_0010
Create Date: 2026-06-18
"""

from alembic import op
import sqlalchemy as sa

revision = "20260618_0011"
down_revision = "20260603_0010"
branch_labels = None
depends_on = None


def table_exists(table_name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table_name)


def upgrade() -> None:
    if not table_exists("instagram_automation_rules"):
        op.create_table(
            "instagram_automation_rules",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("store_id", sa.Integer(), nullable=False),
            sa.Column("instagram_account_id", sa.Integer(), nullable=True),
            sa.Column("campaign_id", sa.Integer(), nullable=True),
            sa.Column("post_id", sa.Integer(), nullable=True),
            sa.Column("name", sa.String(length=255), server_default="", nullable=False),
            sa.Column("status", sa.String(length=64), server_default="draft", nullable=False),
            sa.Column("trigger_type", sa.String(length=64), server_default="exact", nullable=False),
            sa.Column("trigger_keywords", sa.Text(), server_default="[]", nullable=False),
            sa.Column("normalized_keywords", sa.Text(), server_default="[]", nullable=False),
            sa.Column("private_reply_message", sa.Text(), server_default="", nullable=False),
            sa.Column("public_reply_enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("public_reply_message", sa.Text(), server_default="", nullable=False),
            sa.Column("match_limit_per_hour", sa.Integer(), server_default="60", nullable=False),
            sa.Column("match_limit_total", sa.Integer(), server_default="0", nullable=False),
            sa.Column("starts_at", sa.DateTime(), nullable=True),
            sa.Column("ends_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["store_id"], ["stores.id"]),
            sa.ForeignKeyConstraint(["instagram_account_id"], ["instagram_accounts.id"]),
            sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"]),
            sa.ForeignKeyConstraint(["post_id"], ["posts.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        for column in ["id", "store_id", "instagram_account_id", "campaign_id", "post_id", "status", "starts_at", "ends_at"]:
            op.create_index(op.f(f"ix_instagram_automation_rules_{column}"), "instagram_automation_rules", [column], unique=False)

    if not table_exists("instagram_automation_events"):
        op.create_table(
            "instagram_automation_events",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("store_id", sa.Integer(), nullable=False),
            sa.Column("rule_id", sa.Integer(), nullable=True),
            sa.Column("instagram_account_id", sa.Integer(), nullable=True),
            sa.Column("post_id", sa.Integer(), nullable=True),
            sa.Column("ig_media_id", sa.String(length=255), server_default="", nullable=False),
            sa.Column("ig_comment_id", sa.String(length=255), server_default="", nullable=False),
            sa.Column("commenter_username", sa.String(length=255), server_default="", nullable=False),
            sa.Column("comment_text", sa.Text(), server_default="", nullable=False),
            sa.Column("normalized_comment_text", sa.Text(), server_default="", nullable=False),
            sa.Column("event_status", sa.String(length=64), server_default="received", nullable=False),
            sa.Column("skip_reason", sa.Text(), server_default="", nullable=False),
            sa.Column("failure_reason", sa.Text(), server_default="", nullable=False),
            sa.Column("private_reply_message_id", sa.String(length=255), server_default="", nullable=False),
            sa.Column("public_reply_comment_id", sa.String(length=255), server_default="", nullable=False),
            sa.Column("webhook_payload", sa.Text(), server_default="{}", nullable=False),
            sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("last_attempt_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["store_id"], ["stores.id"]),
            sa.ForeignKeyConstraint(["rule_id"], ["instagram_automation_rules.id"]),
            sa.ForeignKeyConstraint(["instagram_account_id"], ["instagram_accounts.id"]),
            sa.ForeignKeyConstraint(["post_id"], ["posts.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        for column in ["id", "store_id", "rule_id", "instagram_account_id", "post_id", "ig_media_id", "ig_comment_id", "event_status"]:
            op.create_index(op.f(f"ix_instagram_automation_events_{column}"), "instagram_automation_events", [column], unique=False)


def downgrade() -> None:
    if table_exists("instagram_automation_events"):
        for column in ["event_status", "ig_comment_id", "ig_media_id", "post_id", "instagram_account_id", "rule_id", "store_id", "id"]:
            op.drop_index(op.f(f"ix_instagram_automation_events_{column}"), table_name="instagram_automation_events")
        op.drop_table("instagram_automation_events")

    if table_exists("instagram_automation_rules"):
        for column in ["ends_at", "starts_at", "status", "post_id", "campaign_id", "instagram_account_id", "store_id", "id"]:
            op.drop_index(op.f(f"ix_instagram_automation_rules_{column}"), table_name="instagram_automation_rules")
        op.drop_table("instagram_automation_rules")