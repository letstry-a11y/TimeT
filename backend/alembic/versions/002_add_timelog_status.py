"""Add status field to time_logs table and update log_type enum

Revision ID: 002_add_timelog_status
Revises: 001_initial
Create Date: 2025-01-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_add_timelog_status'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # For SQLite, we need to handle enum differently
    # Add the status column to time_logs table
    op.add_column(
        'time_logs',
        sa.Column(
            'status',
            sa.String(20),
            nullable=True
        )
    )

    # Note: For SQLite, we cannot easily modify the ENUM type of log_type
    # The new 'planned' value will be handled by the application layer
    # For PostgreSQL, you would need to alter the enum type


def downgrade() -> None:
    op.drop_column('time_logs', 'status')
