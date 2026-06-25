"""Initial application schema.

Revision ID: 20260524_0001
Revises:
Create Date: 2026-05-24
"""

from collections.abc import Iterable

from alembic import op
import sqlalchemy as sa

revision = "20260524_0001"
down_revision = None
branch_labels = None
depends_on = None


def table_exists(table_name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table_name)


def column_names(table_name: str) -> set[str]:
    if not table_exists(table_name):
        return set()
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)}


def add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if column.name not in column_names(table_name):
        op.add_column(table_name, column)


def index_exists(table_name: str, index_name: str) -> bool:
    if not table_exists(table_name):
        return False
    return any(index["name"] == index_name for index in sa.inspect(op.get_bind()).get_indexes(table_name))


def create_index_if_missing(index_name: str, table_name: str, columns: Iterable[str], unique: bool = False) -> None:
    if not index_exists(table_name, index_name):
        op.create_index(index_name, table_name, list(columns), unique=unique)


def upgrade() -> None:
    if not table_exists("users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("password_hash", sa.String(length=255), nullable=False),
            sa.Column("full_name", sa.String(length=255), server_default="Admin", nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    create_index_if_missing("ix_users_id", "users", ["id"])
    create_index_if_missing("ix_users_email", "users", ["email"], unique=True)

    if not table_exists("stores"):
        op.create_table(
            "stores",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("category", sa.String(length=255), server_default="", nullable=False),
            sa.Column("phone", sa.String(length=64), server_default="", nullable=False),
            sa.Column("description", sa.Text(), server_default="", nullable=False),
            sa.Column("logo_asset_id", sa.Integer(), nullable=True),
            sa.Column("avatar_asset_id", sa.Integer(), nullable=True),
            sa.Column("brand_primary_color", sa.String(length=32), server_default="#0F766E", nullable=False),
            sa.Column("brand_accent_color", sa.String(length=32), server_default="#2563EB", nullable=False),
            sa.Column("brand_voice", sa.Text(), server_default="", nullable=False),
            sa.Column("default_cta", sa.Text(), server_default="", nullable=False),
            sa.Column("content_guidelines", sa.Text(), server_default="", nullable=False),
            sa.Column("default_hashtags", sa.Text(), server_default="", nullable=False),
            sa.Column("caption_footer", sa.Text(), server_default="", nullable=False),
            sa.Column("timezone", sa.String(length=64), server_default="Asia/Tehran", nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    else:
        add_column_if_missing("stores", sa.Column("logo_asset_id", sa.Integer(), nullable=True))
        add_column_if_missing("stores", sa.Column("avatar_asset_id", sa.Integer(), nullable=True))
        add_column_if_missing("stores", sa.Column("brand_primary_color", sa.String(length=32), server_default="#0F766E", nullable=False))
        add_column_if_missing("stores", sa.Column("brand_accent_color", sa.String(length=32), server_default="#2563EB", nullable=False))
        add_column_if_missing("stores", sa.Column("brand_voice", sa.Text(), server_default="", nullable=False))
        add_column_if_missing("stores", sa.Column("default_cta", sa.Text(), server_default="", nullable=False))
        add_column_if_missing("stores", sa.Column("content_guidelines", sa.Text(), server_default="", nullable=False))
    create_index_if_missing("ix_stores_id", "stores", ["id"])

    if not table_exists("rubika_accounts"):
        op.create_table(
            "rubika_accounts",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("bot_token", sa.Text(), server_default="", nullable=False),
            sa.Column("chat_id", sa.String(length=255), server_default="", nullable=False),
            sa.Column("bot_name", sa.String(length=255), server_default="", nullable=False),
            sa.Column("status", sa.String(length=64), server_default="not_tested", nullable=False),
            sa.Column("last_error", sa.Text(), server_default="", nullable=False),
            sa.Column("last_test_at", sa.DateTime(), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    create_index_if_missing("ix_rubika_accounts_id", "rubika_accounts", ["id"])

    if not table_exists("posts"):
        op.create_table(
            "posts",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("store_id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=255), server_default="", nullable=False),
            sa.Column("caption", sa.Text(), server_default="", nullable=False),
            sa.Column("hashtags", sa.Text(), server_default="", nullable=False),
            sa.Column("platform", sa.String(length=64), server_default="rubika", nullable=False),
            sa.Column("status", sa.String(length=64), server_default="draft", nullable=False),
            sa.Column("timezone", sa.String(length=64), server_default="Asia/Tehran", nullable=False),
            sa.Column("campaign", sa.String(length=255), server_default="", nullable=False),
            sa.Column("internal_note", sa.Text(), server_default="", nullable=False),
            sa.Column("scheduled_at", sa.DateTime(), nullable=True),
            sa.Column("ready_at", sa.DateTime(), nullable=True),
            sa.Column("published_at", sa.DateTime(), nullable=True),
            sa.Column("failed_at", sa.DateTime(), nullable=True),
            sa.Column("rubika_message_id", sa.String(length=255), server_default="", nullable=False),
            sa.Column("last_error", sa.Text(), server_default="", nullable=False),
            sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["store_id"], ["stores.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    else:
        add_column_if_missing("posts", sa.Column("timezone", sa.String(length=64), server_default="Asia/Tehran", nullable=False))
        add_column_if_missing("posts", sa.Column("campaign", sa.String(length=255), server_default="", nullable=False))
        add_column_if_missing("posts", sa.Column("internal_note", sa.Text(), server_default="", nullable=False))
        add_column_if_missing("posts", sa.Column("scheduled_at", sa.DateTime(), nullable=True))
        add_column_if_missing("posts", sa.Column("ready_at", sa.DateTime(), nullable=True))
        add_column_if_missing("posts", sa.Column("published_at", sa.DateTime(), nullable=True))
        add_column_if_missing("posts", sa.Column("failed_at", sa.DateTime(), nullable=True))
        add_column_if_missing("posts", sa.Column("rubika_message_id", sa.String(length=255), server_default="", nullable=False))
        add_column_if_missing("posts", sa.Column("last_error", sa.Text(), server_default="", nullable=False))
        add_column_if_missing("posts", sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False))
    create_index_if_missing("ix_posts_id", "posts", ["id"])
    create_index_if_missing("ix_posts_store_id", "posts", ["store_id"])
    create_index_if_missing("ix_posts_status", "posts", ["status"])
    create_index_if_missing("ix_posts_scheduled_at", "posts", ["scheduled_at"])

    if not table_exists("media_assets"):
        op.create_table(
            "media_assets",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("store_id", sa.Integer(), nullable=False),
            sa.Column("post_id", sa.Integer(), nullable=True),
            sa.Column("original_filename", sa.String(length=255), server_default="", nullable=False),
            sa.Column("stored_filename", sa.String(length=255), nullable=False),
            sa.Column("file_path", sa.Text(), nullable=False),
            sa.Column("content_type", sa.String(length=128), server_default="", nullable=False),
            sa.Column("size_bytes", sa.Integer(), server_default="0", nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["post_id"], ["posts.id"]),
            sa.ForeignKeyConstraint(["store_id"], ["stores.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("stored_filename"),
        )
    create_index_if_missing("ix_media_assets_id", "media_assets", ["id"])
    create_index_if_missing("ix_media_assets_store_id", "media_assets", ["store_id"])
    create_index_if_missing("ix_media_assets_post_id", "media_assets", ["post_id"])

    if not table_exists("publish_attempts"):
        op.create_table(
            "publish_attempts",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("post_id", sa.Integer(), nullable=False),
            sa.Column("action", sa.String(length=64), server_default="manual", nullable=False),
            sa.Column("status", sa.String(length=64), server_default="created", nullable=False),
            sa.Column("request_payload", sa.Text(), server_default="", nullable=False),
            sa.Column("response_payload", sa.Text(), server_default="", nullable=False),
            sa.Column("error", sa.Text(), server_default="", nullable=False),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("finished_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["post_id"], ["posts.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    create_index_if_missing("ix_publish_attempts_id", "publish_attempts", ["id"])
    create_index_if_missing("ix_publish_attempts_post_id", "publish_attempts", ["post_id"])
    create_index_if_missing("ix_publish_attempts_status", "publish_attempts", ["status"])


def downgrade() -> None:
    op.drop_table("publish_attempts")
    op.drop_table("media_assets")
    op.drop_table("posts")
    op.drop_table("rubika_accounts")
    op.drop_table("stores")
    op.drop_table("users")
