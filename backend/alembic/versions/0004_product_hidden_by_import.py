"""product hidden_by_import

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("products") as batch_op:
        batch_op.add_column(
            sa.Column("hidden_by_import", sa.Boolean(), nullable=False, server_default=sa.false())
        )
    # снятые импортом раньше: импорт ставил is_active=False вместе с in_stock=False
    op.execute(
        "UPDATE products SET hidden_by_import = true "
        "WHERE source_url IS NOT NULL AND is_active = false AND in_stock = false"
    )


def downgrade() -> None:
    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_column("hidden_by_import")
