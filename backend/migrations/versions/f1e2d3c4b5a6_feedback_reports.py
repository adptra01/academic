"""add feedback_reports (beta problem reporting)

Revision ID: f1e2d3c4b5a6
Revises: c328765abd10
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from alembic import op

revision: str = 'f1e2d3c4b5a6'
down_revision: Union[str, None] = 'c328765abd10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CATEGORIES = ('statistical_result', 'assumption', 'formula', 'data_processing', 'export', 'ui', 'other')


def upgrade() -> None:
    op.create_table(
        'feedback_reports',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('analysis_id', UUID(as_uuid=True), sa.ForeignKey('analyses.id', ondelete='SET NULL'), nullable=True),
        sa.Column('analysis_uid', sa.Text(), nullable=False),
        sa.Column('dataset_version_number', sa.Integer(), nullable=True),
        sa.Column('category', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_feedback_user', 'feedback_reports', ['user_id'])


def downgrade() -> None:
    op.drop_index('idx_feedback_user', table_name='feedback_reports')
    op.drop_table('feedback_reports')
