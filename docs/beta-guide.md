# Panduan Beta Tertutup (Gate 2) — 20–50 pengguna

## Akun & mulai (5 menit)

1. Buka frontend, Register (atau pakai demo: `demo@kampus.ac.id` / `Demo12345`).
2. Atau jalankan `./scripts/seed_demo.sh` untuk project contoh berisi analisis.

## Skenario wajib (task completion test, ±45 menit)

```text
Create Project → Upload CSV sendiri → Preview → Variables (set role) →
Preprocessing (minimal 1 op) → Run 2 metode berbeda → Cek asumsi →
Baca formula + calculation → Copy APA → Export PDF → Rerun → Research Log
```

Target: **≥90% menyelesaikan tanpa bantuan developer.**

## Yang dinilai (bukan "websitenya bagus?")

- Scientific usability: paham pemilihan metode? asumsi? formula? calculation? output dapat dipertanggungjawabkan? ada hasil membingungkan? dapat mengulang analisis?
- Technical: upload/preprocessing/export gagal? browser apa? dataset berapa besar? analisis bersamaan?

## Melapor masalah

Gunakan **Report a Problem di halaman hasil** (kategori + deskripsi; Analysis ID +
dataset version otomatis terlampir). Untuk masalah umum (login, upload):
catat email akun + waktu + browser + langkah reproduksi.

## Aturan beta

- Data penelitian nyata boleh dipakai; data sensitif menjadi tanggung jawab pemilik.
- Jangan bagikan kredensial; satu akun per orang.
- Bug kritis (angka salah, data bocor antar-user): lapor segera via kategori
  `statistical_result` + tandai "KRITIS" di awal deskripsi.
