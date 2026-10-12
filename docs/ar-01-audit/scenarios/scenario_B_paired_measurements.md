# Scenario B: Pengukuran Berpasangan (Paired t-test)

## Desain Penelitian
**Pertanyaan**: Apakah skor kepuasan pelanggan berubah setelah perbaikan layanan?
**Desain**: Within-subjects, dua pengukuran pada subjek yang sama (pre-post).
**Variabel**:
- `id_pelanggan` (ID) — pengenal subjek
- `pre_score` (numerik) — skor sebelum perbaikan
- `post_score` (numerik) — skor sesudah perbaikan

## Dataset Uji

### B1: Pasangan Lengkap, Perubahan Signifikan
```csv
id_pelanggan,pre_score,post_score
1,3.2,4.1
2,3.5,4.3
3,2.8,3.9
4,3.0,4.0
5,3.3,4.2
6,2.9,3.8
7,3.1,4.0
8,3.4,4.4
9,2.7,3.7
10,3.0,3.9
11,3.2,4.1
12,3.5,4.3
13,2.9,3.8
14,3.1,4.0
15,3.3,4.2
```
- n = 15 pasangan lengkap
- Rata-rata meningkat ~0.9 → paired t-test signifikan

### B2: Pasangan Tidak Lengkap (Missing di salah satu sisi)
```csv
id_pelanggan,pre_score,post_score
1,3.2,4.1
2,3.5,
3,2.8,3.9
4,3.0,4.0
5,,4.2
6,2.9,3.8
7,3.1,4.0
8,3.4,4.4
9,2.7,3.7
10,3.0,3.9
```
- 2 baris missing (id 2 post, id 5 pre) → n_analisis = 8, n_source = 10
- Harus memicu warning n dibuang di result view

### B3: ID Duplikat (subjek terdua)
```csv
id_pelanggan,pre_score,post_score
1,3.2,4.1
2,3.5,4.3
2,3.5,4.3
3,2.8,3.9
4,3.0,4.0
5,3.3,4.2
6,2.9,3.8
7,3.1,4.0
8,3.4,4.4
9,2.7,3.7
```
- ID 2 duplikat → harus memicu MA-01
- n_analisis = 9 (pasangan valid), tapi duplikat membesar-besarkan n

### B4: Urutan Baris Teracak
```csv
id_pelanggan,pre_score,post_score
5,3.3,4.2
1,3.2,4.1
3,2.8,3.9
2,3.5,4.3
4,3.0,4.0
```
- Urutan acak → uji apakah pairing tetap benar (berdasarkan ID, bukan urutan baris)

---

## Hasil Acuan (SciPy)

| Skenario | n_pairs | t-stat | df | p-value | Cohen's dz | Keputusan |
|----------|---------|--------|----|---------|------------|-----------|
| B1 | 15 | ~10.3 | 14 | <0.001 | ~2.7 | Tolak H₀ |
| B2 | 8 | (dengan n_dropped=2 warning) | 7 | | | |
| B3 | 9 (dengan duplikat) | | | | | MA-01 triggered |
| B4 | 5 | (acak urutan) | 4 | | | |