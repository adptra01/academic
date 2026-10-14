"""add dataset_versions manifest (content_hash, schema_version, collector_version, normalization_version, record_count, validation_report)

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from alembic import op

revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('dataset_versions', sa.Column('content_hash', sa.String(64), nullable=True))
    op.add_column('dataset_versions', sa.Column('schema_version', sa.String(16), nullable=False, server_default=sa.text("'1.0'")))
    op.add_column('dataset_versions', sa.Column('collector_version', sa.Text(), nullable=True))
    op.add_column('dataset_versions', sa.Column('normalization_version', sa.String(16), nullable=False, server_default=sa.text("'1.0'")))
    op.add_column('dataset_versions', sa.Column('record_count', sa.Integer(), nullable=True))
    op.add_column('dataset_versions', sa.Column('validation_report', JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column('dataset_versions', 'validation_report')
    op.drop_column('dataset_versions', 'record_count')
    op.drop_column('dataset_versions', 'normalization_version')
    op.drop_column('dataset_versions', 'collector_version')
    op.drop_column('dataset_versions', 'schema_version')
    op.drop_column('dataset_versions', 'content_hash')
