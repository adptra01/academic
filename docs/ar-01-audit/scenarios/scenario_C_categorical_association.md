# Scenario C: Dua Variabel Kategorikal (Chi-Square Independence)

## Desain Penelitian
**Pertanyaan**: Apakah ada asosiasi antara *jenis layanan* dan *tingkat kepuasan*?
**Desain**: Cross-sectional, dua variabel kategorikal.
**Variabel**:
- `service_type` (kategorikal: "mobile", "web", "desktop") — variabel baris
- `satisfaction` (kategorikal ordinal: "rendah", "sedang", "tinggi") — variabel kolom

## Dataset Uji

### C1: Standar, Expected ≥ 5
```csv
service_type,satisfaction
mobile,tinggi
mobile,tinggi
mobile,sedang
mobile,sedang
mobile,rendah
web,tinggi
web,tinggi
web,tinggi
web,sedang
web,sedang
web,rendah
web,rendah
desktop,sedang
desktop,sedang
desktop,rendah
desktop,rendah
desktop,rendah
```
- 3×3 tabel, n=17
- Semua expected ≥ 5 → chi-square asimtotik valid

### C2: Frekuensi Harapan Rendah (<5)
```csv
service_type,satisfaction
mobile,tinggi
mobile,tinggi
mobile,sedang
web,tinggi
web,sedang
web,rendah
desktop,rendah
desktop,rendah
```
- 3×3 tabel, n=8
- Banyak sel expected < 5 → harus memicu warning chi-square
- Alternatif: Fisher's Exact (di luar MVP)

### C3: Label Kategori Berbeda Ejaan (Data Entry Error)
```csv
service_type,satisfaction
mobile,tinggi
mobile,tinggi
Mobile,sedang
mobile,sedang
web,tinggi
web,tinggi
web,tinggi
web,sedang
web,sedang
web,rendah
web,rendah
desktop,sedang
desktop,sedang
desktop,rendah
desktop,rendah
desktop,rendah
```
- "mobile" vs "Mobile" → 4 kategori bukan 3
- Harus memicu MA-02 (missing/kategori tidak valid) atau MA-01 jika ID

### C4: Tabel Tidak Seimbang (Sparse)
```csv
service_type,satisfaction
mobile,tinggi
mobile,tinggi
mobile,tinggi
mobile,tinggi
mobile,tinggi
mobile,tinggi
mobile,tinggi
mobile,tinggi
mobile,tinggi
mobile,tinggi
web,sedang
web,rendah
desktop,rendah
```
- `mobile` dominated "tinggi" (10/13), `web` & `desktop` sedikit
- Expected frequency sangat rendah untuk kombinasi langka

---

## Hasil Acuan (SciPy / R)

| Skenario | n | χ² | df | p-value | Cramér's V | Warning |
|----------|---|-----|----|---------|------------|---------|
| C1 | 17 | ~4.2 | 4 | ~0.38 | ~0.35 | Tidak |
| C2 | 8 | (low expected) | 4 | (warning) | | Expected < 5 |
| C3 | 17 | (4 kategori) | 6 | | | Label inconsistency |
| C4 | 13 | (sparse) | 4 | | | Expected < 5 banyak |