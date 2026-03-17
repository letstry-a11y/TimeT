"""Convert all datetime columns from UTC to Beijing time (UTC+8)

Revision ID: 003_convert_utc_to_beijing_time
Revises: 002_add_timelog_status
Create Date: 2026-03-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = '003_convert_utc_to_beijing_time'
down_revision: Union[str, None] = '002_add_timelog_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# All tables and their datetime columns to migrate
DATETIME_COLUMNS = {
    'users': ['created_at', 'updated_at'],
    'visions': ['created_at', 'updated_at'],
    'goals': ['created_at', 'updated_at'],
    'tasks': ['created_at', 'updated_at', 'completed_at'],
    'time_logs': ['start_time', 'end_time', 'created_at', 'updated_at'],
}


def upgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name

    for table, columns in DATETIME_COLUMNS.items():
        for col in columns:
            if dialect == 'sqlite':
                # SQLite: add 8 hours using datetime() function
                op.execute(
                    text(
                        f"UPDATE {table} SET {col} = datetime({col}, '+8 hours') "
                        f"WHERE {col} IS NOT NULL"
                    )
                )
            else:
                # PostgreSQL / MySQL: use INTERVAL syntax
                op.execute(
                    text(
                        f"UPDATE {table} SET {col} = {col} + INTERVAL '8 hours' "
                        f"WHERE {col} IS NOT NULL"
                    )
                )


def downgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name

    for table, columns in DATETIME_COLUMNS.items():
        for col in columns:
            if dialect == 'sqlite':
                op.execute(
                    text(
                        f"UPDATE {table} SET {col} = datetime({col}, '-8 hours') "
                        f"WHERE {col} IS NOT NULL"
                    )
                )
            else:
                op.execute(
                    text(
                        f"UPDATE {table} SET {col} = {col} - INTERVAL '8 hours' "
                        f"WHERE {col} IS NOT NULL"
                    )
                )
