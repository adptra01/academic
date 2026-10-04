# Runbook Produksi VPS (MVP)

## 1. Secrets (sebelum deploy pertama)

```bash
cp .env.example .env
chmod 600 .env
openssl rand -hex 32  # → JWT_SECRET (min 32 char, startup menolak jika pendek)
openssl rand -hex 16  # → POSTGRES_PASSWORD / S3_SECRET_KEY
```

Wajib di prod: `ENV=prod`, `COOKIE_SECURE=true`, `BACKEND_CORS_ORIGINS=https://domain-anda`.

## 2. Deploy

```bash
docker compose up --build -d
curl https://domain-anda/health  # {"status":"ok"}
```

## 3. TLS

Akhiri TLS di Nginx VPS (certbot) atau reverse proxy di depan compose. Tanpa HTTPS,
jangan set `ENV=prod` (cookie secure akan ditolak startup — itu disengaja).

## 4. Database

- Migrasi schema: `db/init.sql` idempoten (`IF NOT EXISTS`). Perubahan kolom baru
  dicatat di CHANGELOG + ALTER manual (lihat riwayat: `citext`, `storage_path`).
- Sejak 2026-10-04: Alembic aktif (`backend/alembic.ini`, baseline `c328765abd10` sudah
  di-stamp). Perubahan baru WAJIB revisi Alembic:
  `ddev exec -s backend "cd /code && alembic -c alembic.ini revision --autogenerate -m <nama>"`,
  salin file dari container ke `backend/migrations/versions/`, review diff, lalu upgrade.
- Backup harian: `scripts/backup.sh` via cron (retensi 14 hari). Uji restore tiap bulan:
  `pg_restore -d academic_mvp Backups/<tgl>/academic_db.dump`.

## 5. Operasional

- Rate limit auth: 10/menit/IP (429 jika lebih).
- Upload ≤50MB, ekstensi+MIME divalidasi; file di S3 (prod) — jangan commit dataset.
- Logs: `docker compose logs backend worker`; security headers aktif
  (nosniff, DENY frame, no-referrer).
- research_logs append-only: tidak ada endpoint UPDATE/DELETE — jangan buat.
- Access token media sosial (fase pasca-MVP): terenkripsi, tidak plaintext.

## 6. Checklist go-live

- [ ] `.env` 600, secrets diganti, CORS = domain prod saja
- [ ] `ENV=prod`, `COOKIE_SECURE=true`, TLS aktif
- [ ] Backup cron jalan + restore pernah diuji
- [ ] Scientific validation (docs/scientific-validation.md) PASS semua 15 metode
- [ ] Beta 20-50 peneliti selesai, temuan ditutup
