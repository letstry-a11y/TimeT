"""Store each user's daily planning start.

Revision ID: 004_journal_availability
Revises: 003_personal_journal
"""
import sqlalchemy as sa
from alembic import op
from app.db.types import GUID

revision = "004_journal_availability"
down_revision = "003_personal_journal"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "journal_availability",
        sa.Column("user_id", GUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("start_minute", sa.Integer(), nullable=False),
        sa.CheckConstraint("start_minute >= 0 AND start_minute < 1440", name="start_minute"),
    )


def downgrade():
    op.drop_table("journal_availability")
