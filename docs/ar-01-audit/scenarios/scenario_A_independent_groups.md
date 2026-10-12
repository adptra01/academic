# Scenario A: Dua Kelompok Independen (Independent t-test)

## Desain Penelitian
**Pertanyaan**: Apakah nilai *service quality* berbeda antara pelanggan yang menggunakan aplikasi mobile vs website?
**Desain**: Between-subjects, dua kelompok independen.
**Variabel**:
- `group` (kategorikal, 2 level: "mobile", "web") — variabel pengelompok
- `service_quality` (numerik, kontinu) — variabel hasil

## Dataset Uji

### A1: Seimbang, Varians Sama (Student's t-test)
```csv
group,service_quality
mobile,4.2
mobile,3.8
mobile,4.5
mobile,4.0
mobile,4.3
mobile,3.9
mobile,4.1
mobile,4.4
mobile,3.7
mobile,4.2
web,3.5
web,3.2
web,3.8
web,3.4
web,3.6
web,3.1
web,3.3
web,3.7
web,3.0
web,3.4
```
- n₁ = n₂ = 10
- mean₁ ≈ 4.11, mean₂ ≈ 3.40
- Varians sebanding → Student's t-test cocok

### A2: Tidak Seimbang, Varians Berbeda (Welch's t-test)
```csv
group,service_quality
mobile,4.2
mobile,3.8
mobile,4.5
mobile,4.0
mobile,4.3
mobile,3.9
mobile,4.1
mobile,4.4
mobile,3.7
mobile,4.2
mobile,4.0
mobile,4.3
mobile,3.8
mobile,4.1
mobile,4.2
web,3.5
web,3.2
web,3.8
web,3.4
```
- n₁ = 15, n₂ = 5
- Varians kelompok `web` lebih besar → Welch's t-test wajib

### A3: Distribusi Menceng + Pencilan
```csv
group,service_quality
mobile,4.2
mobile,3.8
mobile,4.5
mobile,4.0
mobile,4.3
mobile,3.9
mobile,4.1
mobile,4.4
mobile,3.7
mobile,4.2
mobile,1.0
mobile,1.2
web,3.5
web,3.2
web,3.8
web,3.4
web,3.6
web,3.1
web,3.3
web,3.7
web,3.0
web,3.4
web,5.0
```
- Pencilan di `mobile` (1.0, 1.2) dan `web` (5.0)
- Harus memicu MA-05 (outlier IQR >5%)
- Uji Mann-Whitney sebagai alternatif robust

### A4: ID Duplikat + Missing
```csv
id,group,service_quality
1,mobile,4.2
2,mobile,3.8
2,mobile,4.5
3,mobile,4.0
4,mobile,4.3
5,mobile,3.9
6,mobile,4.1
7,mobile,4.4
8,mobile,3.7
9,mobile,4.2
10,web,3.5
11,web,3.2
12,web,3.8
13,web,3.4
14,web,3.6
15,web,3.1
16,web,3.3
17,web,3.7
18,web,3.0
19,web,3.4
```
- ID 2 duplikat → harus memicu MA-01
- Tidak ada missing → MA-02 tidak memicu

---

## Hasil Acuan (SciPy)

| Skenario | Metode | t-stat | df | p-value | Cohen's d | Keputusan (α=0.05) |
|----------|--------|--------|----|---------|-----------|-------------------|
| A1 | Student's t | ~4.12 | 18 | <0.001 | ~1.3 | Tolak H₀ |
| A2 | Welch's t | ~3.45 | ~5.2 | ~0.017 | ~1.1 | Tolak H₀ |
| A3 | Welch's t | (dengan pencilan) | | | | (bandingkan Mann-Whitney) |
| A4 | Student's t | (tanpa ID duplikat) | | | | |

> **Catatan**: Hasil acuan dihitung ulang saat validasi. Simpan `Analysis ID` dan `result_hash` dari setiap run.