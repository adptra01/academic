"""add oauth_connections contract fields (provider_account_id, granted_scopes, expires_at, status, revoked_at)

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from alembic import op

revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('oauth_connections', sa.Column('provider_account_id', sa.Text(), nullable=True))
    op.add_column('oauth_connections', sa.Column('granted_scopes', JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")))
    op.add_column('oauth_connections', sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('oauth_connections', sa.Column('status', sa.String(16), nullable=False, server_default=sa.text("'active'")))
    op.add_column('oauth_connections', sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('oauth_connections', 'revoked_at')
    op.drop_column('oauth_connections', 'status')
    op.drop_column('oauth_connections', 'expires_at')
    op.drop_column('oauth_connections', 'granted_scopes')
    op.drop_column('oauth_connections', 'provider_account_id')
