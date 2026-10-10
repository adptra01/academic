# Kebijakan Keamanan

Dokumen ini menjelaskan bagaimana keamanan ditangani di repositori ini, cara
melaporkan celah, dan apa yang **belum** selesai. Ditulis sesuai kondisi kode
saat ini — bukan aspirasi.

---

## 1. Melaporkan celah keamanan

**Jangan buka issue publik untuk celah keamanan.**

Kirim laporan privat melalui fitur **Security Advisories** GitHub
(*Security → Report a vulnerability*) ke maintainer `adptra01`, atau hubungi
langsung pemilik repositori.

Yang membantu kami dalam laporan:

- Deskripsi singkat celah dan dampaknya
- Langkah reproduksi atau proof-of-concept
- Komponen yang terpengaruh (endpoint/service/file)
- Saran perbaatan bila ada

Kami berusaha menanggapi dalam **7 hari**. Jika celah diterima, kredit akan
diberikan kepada pelapor pada catatan rilis.

---

## 2. Rahasia & kredensial

### Aturan

- `.env` **tidak boleh** di-commit. Sudah tercatat di `.gitignore`.
- Salin dari `.env.example` lalu `chmod 600 .env`.
- Semua kunci wajib di-generate di mesin Anda sendiri — jangan menyalin dari
  repo, dokumentasi, chat, atau commit lama:

```bash
openssl rand -hex 32        # POSTGRES_PASSWORD, JWT_SECRET (64 char), COOKIE_SECRET
openssl rand -base64 32     # OAUTH_ENCRYPTION_KEY (kunci Fernet)
```

- Jika sebuah kunci pernah ter-commit (meski sudah dihapus di commit
  berikutnya), **anggap kunci itu sudah bocor** dan rotasi segera. Riwayat git
  tetap menyimpannya.

### Yang sudah pernah dibersihkan

`OAUTH_ENCRYPTION_KEY` pernah tersimpan sebagai nilai literal di
`.ddev/docker-compose.academic.yaml`. Nilai itu sudah dihapus dari repositori.
Bila Anda pernah memakai nilai yang sama di lingkungan lain (VPS, staging),
**ganti sekarang** — pembaca repositori publik ini sudah pernah melihatnya.

### Kredensial khusus dev

Nilai berikut hanya untuk pengembangan lokal dan **wajib diganti** sebelum
produksi:

| Nilai | Di dev | Di produksi |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | default ddev (`db`) | generate sendiri |
| `JWT_SECRET` | placeholder `local_only_change_me_...` | generate sendiri |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | `minioadmin` | generate sendiri |
| `OAUTH_ENCRYPTION_KEY` | kosong → fallback dev | generate sendiri |

Ketika `OAUTH_ENCRYPTION_KEY` kosong, backend menurunkan kunci dari
`JWT_SECRET` dan menandai koneksi OAuth sebagai `dev-fallback` di metadata.
Ini **hanya untuk dev**.

---

## 3. Yang sudah diterapkan

| Area | Implementasi | Lokasi |
| --- | --- | --- |
| Hashing password | bcrypt (passlib ditinggalkan karena tidak kompatibel dengan bcrypt 5.x) | `backend/app/core/security.py` |
| Sesi | JWT di cookie **HttpOnly**, `SameSite=lax`, `Secure` mengikuti `COOKIE_SECURE`, kedaluwarsa 24 jam | `backend/app/routers/auth.py` |
| Rate limiting | `slowapi`, **10/menit** pada endpoint auth (register, login, ganti password, OAuth Google) | `app/core/rate.py`, `app/routers/auth.py` |
| Isolasi data | Semua query project/dataset/analisis difilter `user_id` milik pemilik — tidak ada endpoint lintas-user | `backend/app/routers/projects.py` dan router lain |
| Upload | Whitelist ekstensi, batas ukuran (`413` bila melebihi `MAX_UPLOAD_MB`), tolak file kosong | `backend/app/routers/datasets.py` |
| Nama file | Disanitasi (karakter non-alfanumerik → `_`, dipotong 120 karakter, diawali UUID) sehingga tidak rawan *path traversal* | `backend/app/core/storage.py` |
| Log penelitian | `research_logs` **append-only** — tidak ada endpoint `PUT`/`PATCH`/`DELETE` untuknya | `backend/app/routers/` (tidak ada route ubah/hapus) |
| Token OAuth | Dienkripsi dengan Fernet; token mentah tidak masuk log ilmiah, hanya metadata (provider, waktu, hash scope) | `backend/app/services/connectors/oauth.py` |
| Scraping | Hanya domain yang masuk allowlist; allowlist kosong berarti tolak semua. Tidak ada scraping media sosial | `docs/scraping-policy.md` |
| AI | Tidak ada LLM yang menghitung statistik. Seluruh angka dihitung engine Python deterministik dan lolos validasi terhadap R/SPSS | `docs/adr/0001-ai-must-not-compute.md` |

---

## 4. Yang BELUM selesai (jujur)

Perhatikan ini sebelum mengandalkan aplikasi untuk data sensitif:

| Celah | Dampak | Rencana |
| --- | --- | --- |
| **Tidak ada validasi MIME/isi berkas** saat upload — hanya ekstensi yang diperiksa | Berkas berbahaya bisa diunggah dengan ekstensi yang dizip | Validasi *magic byte*/tipe nyata saat baca file |
| **Delete dataset = hapus permanen** (`204`), bukan soft-delete | Data hilang segera, tidak dapat dipulihkan | Soft-delete + penghapusan fisik terjadwal |
| **Belum ada audit log login** (gagal/berhasil) | Sulit mendeteksi percobaan masuk paksa | Catat percobaan login dengan IP + waktu |
| **Rate limit hanya di endpoint auth** | Endpoint analisis/export masih bisa dibanjiri | Terapkan limit bertingkat sesuai biaya operasi |
| **Tidak ada enkripsi at-rest** untuk file di volume storage | Berkas mentah terbaca bila host/snapshots bocor | Volume terenkripsi atau enkripsi aplikasi |
| **Belum ada CI keamanan** (dependency audit/SAST) | Ketergantungan rentan baru terdeteksi manual | Tambahkan pipeline audit + pemindaian |

---

## 5. Checklist sebelum produksi

- [ ] `ENV=prod` dan `COOKIE_SECURE=true`
- [ ] `BACKEND_CORS_ORIGINS` hanya berisi domain Anda (tanpa `*`, tanpa `localhost`)
- [ ] Semua rahasia di atas digenerate — **tidak ada nilai default dev yang tersisa**
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` diisi bila OAuth dipakai
- [ ] Terminasi TLS aktif (Nginx/VPS) — lihat `docs/runbook-prod.md`
- [ ] `alembic upgrade head` sudah dijalankan
- [ ] Backup harian PostgreSQL + volume storage aktif
- [ ] `SCRAPER_ALLOWLIST` dikosongkan bila scraping tidak dipakai

---

## 6. Versi yang didukung

Hanya commit terbaru di branch default (`master`) yang menerima perbaikan
keamanan. Cabang fitur dan rilis lama tidak dipelihara.
