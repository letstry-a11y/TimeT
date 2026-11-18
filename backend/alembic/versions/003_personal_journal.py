"""Personal time journal, goal rewards and review snapshots.

Revision ID: 003_personal_journal
Revises: 002_add_timelog_status
"""
from alembic import op
import sqlalchemy as sa
from app.db.types import GUID

revision = "003_personal_journal"
down_revision = "002_add_timelog_status"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("daily_activities",
        sa.Column("id", GUID(), primary_key=True), sa.Column("user_id", GUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(20), nullable=False), sa.Column("note", sa.Text(), nullable=False),
        sa.Column("start_time", sa.DateTime(), nullable=False), sa.Column("end_time", sa.DateTime(), nullable=False))
    op.create_index("ix_daily_activities_user_id", "daily_activities", ["user_id"])
    op.create_index("ix_daily_activities_start_time", "daily_activities", ["start_time"])
    op.create_table("goal_rewards",
        sa.Column("goal_id", GUID(), sa.ForeignKey("goals.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", GUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reward", sa.String(160), nullable=False), sa.Column("outcome", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False))
    op.create_index("ix_goal_rewards_user_id", "goal_rewards", ["user_id"])
    op.create_table("review_snapshots",
        sa.Column("id", GUID(), primary_key=True), sa.Column("user_id", GUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False), sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False), sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("reflection", sa.Text(), nullable=False), sa.Column("next_step", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False), sa.UniqueConstraint("user_id", "kind", "period_start", "version"))
    op.create_index("ix_review_snapshots_user_id", "review_snapshots", ["user_id"])


def downgrade():
    op.drop_table("review_snapshots")
    op.drop_table("goal_rewards")
    op.drop_table("daily_activities")
