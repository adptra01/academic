"""add guided-flow tables (research_intents, analysis_configs) + analyses.analysis_config_id/analysis_hash

Revision ID: e5f6a7b8c9d0
Revises: d3e4f5a6b7c8
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
from alembic import op

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'research_intents',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('dataset_version_id', UUID(as_uuid=True), sa.ForeignKey('dataset_versions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('goal_category', sa.String(32), nullable=False),
        sa.Column('design_hints', JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('user_question', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_research_intents_project_id', 'research_intents', ['project_id'])
    op.create_table(
        'analysis_configs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('research_intent_id', UUID(as_uuid=True), sa.ForeignKey('research_intents.id', ondelete='SET NULL'), nullable=True),
        sa.Column('dataset_version_id', UUID(as_uuid=True), sa.ForeignKey('dataset_versions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('method', sa.String(50), nullable=False),
        sa.Column('variables', JSONB, nullable=False),
        sa.Column('params', JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('preprocessing_ops', JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column('status', sa.String(16), nullable=False, server_default=sa.text("'draft'")),
        sa.Column('source_mode', sa.String(8), nullable=False),
        sa.Column('wizard_step', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('preflight_result', JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('executed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_analysis_configs_project_id', 'analysis_configs', ['project_id'])
    op.create_index('ix_analysis_configs_research_intent_id', 'analysis_configs', ['research_intent_id'])
    op.create_index('ix_analysis_configs_dataset_version_id', 'analysis_configs', ['dataset_version_id'])
    op.add_column('analyses', sa.Column('analysis_config_id', UUID(as_uuid=True), sa.ForeignKey('analysis_configs.id'), nullable=True))
    op.create_index('ix_analyses_analysis_config_id', 'analyses', ['analysis_config_id'])
    op.add_column('analyses', sa.Column('analysis_hash', sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column('analyses', 'analysis_hash')
    op.drop_index('ix_analyses_analysis_config_id', table_name='analyses')
    op.drop_column('analyses', 'analysis_config_id')
    op.drop_index('ix_analysis_configs_dataset_version_id', table_name='analysis_configs')
    op.drop_index('ix_analysis_configs_research_intent_id', table_name='analysis_configs')
    op.drop_index('ix_analysis_configs_project_id', table_name='analysis_configs')
    op.drop_table('analysis_configs')
    op.drop_index('ix_research_intents_project_id', table_name='research_intents')
    op.drop_table('research_intents')
