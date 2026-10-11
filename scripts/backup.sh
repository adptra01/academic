#!/bin/bash
# Backup harian: Postgres (pg_dump) + storage datasets/exports.
#
# Otomatis memilih mode berdasarkan lingkungan:
#   - ddev  : pakai `ddev exec` + nama kontainer/volume ddev   (lokal)
#   - compose: pakai `docker compose exec` + volume compose   (VPS/prod)
#
# Cron (VPS):  17 2 * * *  /path/ke/academic/scripts/backup.sh >> /var/log/academic-backup.log 2>&1
#
# Catatan: skrip ini membuat backup. Untuk memastikan nilainya berguna,
# occasionally UJI restore (lihat docs/runbook-prod.md). Backup yang tidak
# pernah di-restore belum membuktikan apa-apa.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${BACKUP_MODE:-auto}"
if [ "$MODE" = "auto" ]; then
  if command -v ddev >/dev/null 2>&1 && ddev describe 2>/dev/null | grep -q academic; then
    MODE="ddev"
  else
    MODE="compose"
  fi
fi

# Direktori tujuan: BACKUP_DIR bila di-set (prod: path di luar repo), default Backups/.
OUT="${BACKUP_DIR:-$ROOT/Backups}/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"

# Ambil kredensial Postgres dari .env bila ada (prod), fallback ke ddev default.
set -a; [ -f .env ] && . ./.env; set +a
PGUSER="${POSTGRES_USER:-db}"
PGDB="${POSTGRES_DB:-db}"

if [ "$MODE" = "ddev" ]; then
  echo "[backup] mode=ddev"
  ddev exec -s db "pg_dump -U ${PGUSER} -d ${PGDB} -F c -f /tmp/academic_backup.dump"
  docker cp ddev-academic-db:/tmp/academic_backup.dump "$OUT/academic_db.dump"
  docker run --rm -v ddev-academic_backend_storage:/data -v "$OUT:/out" alpine \
    tar czf /out/storage.tar.gz -C /data .
else
  echo "[backup] mode=compose"
  docker compose exec -T db pg_dump -U "${PGUSER}" -d "${PGDB}" -F c > "$OUT/academic_db.dump"
  # Volume storage backend dipakai backend+worker; tar via container sekali jalan.
  docker compose run --rm --no-deps -T -v "$OUT:/out" backend \
    tar czf /out/storage.tar.gz -C /code/storage . 2>/dev/null || \
    echo "[backup] PERINGATAN: volume storage kosong/tidak terpasang; storage dilewati"
fi

# Validasi ringan: file dump tidak boleh kosong.
[ -s "$OUT/academic_db.dump" ] || { echo "[backup] GAGAL: academic_db.dump kosong" >&2; exit 1; }

# Retensi: hapus backup lebih tua dari RETENTION_DAYS (default 14).
RETENTION_DAYS="${RETENTION_DAYS:-14}"
find "${BACKUP_DIR:-$ROOT/Backups}" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} + 2>/dev/null || true

echo "[backup] OK -> $OUT"