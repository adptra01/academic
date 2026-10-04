# ADR-0001: AI dilarang menghitung angka ilmiah

Status: **accepted** (invariant arsitektural permanen MVP dan seterusnya).
Tanggal: 2026-10-05.

## Keputusan

AI (LLM internal maupun eksternal):

- BOLEH: menjelaskan hasil, menyarankan metode, membuat draft narasi, membantu membaca output.
- TIDAK BOLEH menjadi sumber: p-value, t/F/χ², koefisien, confidence interval,
  effect size, accuracy, dan angka scientific lainnya.

Semua angka berasal dari **Scientific Engine deterministik** (`backend/app/services/stats/`).

## Konsekuensi

1. Dependensi LLM (daftar di `backend/tests/test_arch_invariant.py`) DILARANG di
   `backend/requirements.txt` maupun import kode — dijaga oleh automated test
   yang menggagalkan CI bila dilanggar.
2. Fitur AI Phase 2 HANYA boleh membaca `analysis_results` yang sudah ada dan
   menghasilkan teks; output AI tidak pernah ditulis ke `analysis_results`.
3. Pelanggaran ADR = defect kritis (setara hasil statistik yang salah).
