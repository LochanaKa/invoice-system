"""add user preferences dashboard layout

Revision ID: 20260630_0115
Revises:
Create Date: 2026-06-30 01:15:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260630_0115"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_preferences",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("system_id", sa.String(length=80), nullable=False),
        sa.Column(
            "dashboard_layout",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_user_preferences_system_id",
        "user_preferences",
        ["system_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_user_preferences_system_id",
        "user_preferences",
        type_="unique",
    )
    op.drop_table("user_preferences")
