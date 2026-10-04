"""baseline: skema == db/init.sql per 2026-10-04 (Alembic autogenerate: 0 create/add ops).

Revision ID: c328765abd10
"""
from typing import Sequence, Union

revision: str = 'c328765abd10'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Baseline no-op: fresh install memakai db/init.sql.
    # Perubahan berikutnya WAJIB via revisi Alembic baru (lihat docs/runbook-prod.md).
    pass


def downgrade() -> None:
    pass
