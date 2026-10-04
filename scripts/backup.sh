#!/bin/bash
# Backup harian: Postgres (pg_dump) + storage datasets/exports.
# Cron: 0 2 * * * /mnt/DiskD/Projects/academic/scripts/backup.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/Backups/$(date +%Y%m%d)"
mkdir -p "$OUT"
cd "$ROOT"
ddev exec -s db "pg_dump -U db -d db -F c -f /tmp/academic_backup.dump"
docker cp ddev-academic-db:/tmp/academic_backup.dump "$OUT/academic_db.dump"
docker run --rm -v ddev-academic_backend_storage:/data -v "$OUT:/out" alpine tar czf /out/storage.tar.gz -C /data .
find "$ROOT/Backups" -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
echo "backup OK: $OUT"
