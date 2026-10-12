# Scenario D: Regresi (Simple & Multiple Linear Regression)

## Desain Penelitian
**Pertanyaan**: Bagaimana *harga* dan *rating* mempengaruhi *volume penjualan*?
**Desain**: Observasional, prediktor kontinu.
**Variabel**:
- `price` (numerik) — prediktor 1
- `rating` (numerik) — prediktor 2 (untuk multiple)
- `sales_volume` (numerik) — variabel hasil

## Dataset Uji

### D1: Regresi Sederhana (Simple Linear)
```csv
price,sales_volume
10000,50
12000,45
15000,40
18000,35
20000,30
22000,28
25000,25
28000,22
30000,20
35000,15
```
- Relasi negatif linear kuat (R² tinggi)
- Tidak ada missing, tidak ada pencilan ekstrem

### D2: Regresi Berganda (Multiple) — Prediktor Berkorelasi (Multikolinearitas)
```csv
price,rating,sales_volume
10000,4.5,50
12000,4.3,45
15000,4.0,40
18000,3.8,35
20000,3.5,30
22000,3.3,28
25000,3.0,25
28000,2.8,22
30000,2.5,20
35000,2.2,15
```
- `price` dan `rating` berkorelasi negatif kuat (r ≈ -0.98)
- VIF harus tinggi (>10) → multikolinearitas serius
- Harus memicu warning diagnostik

### D3: Observasi Ekstrem (Leverage/Influence)
```csv
price,rating,sales_volume
10000,4.5,50
12000,4.3,45
15000,4.0,40
18000,3.8,35
20000,3.5,30
22000,3.3,28
25000,3.0,25
28000,2.8,22
30000,2.5,20
5000,1.0,5
```
- Baris terakhir: harga sangat rendah, rating sangat rendah, sales sangat rendah
- Leverage tinggi → Cook's distance besar
- Harus memicu MA-05 (outlier IQR) untuk prediktor

### D4: Prediktor Tanpa Variasi (Konstan)
```csv
price,rating,sales_volume
10000,4.5,50
10000,4.3,45
10000,4.0,40
10000,3.8,35
10000,3.5,30
10000,3.3,28
10000,3.0,25
10000,2.8,22
10000,2.5,20
10000,2.2,15
```
- `price` konstan (variance = 0)
- Regresi tidak bisa dihitung (singular matrix)
- Harus diblokir pre-flight atau error jelas

### D5: Missing Values
```csv
price,rating,sales_volume
10000,4.5,50
12000,,45
15000,4.0,40
,3.8,35
20000,3.5,30
22000,3.3,28
25000,3.0,25
28000,2.8,
30000,2.5,20
35000,2.2,15
```
- Missing di `rating` dan `sales_volume`
- n_source = 10, n_analisis = 6 (listwise deletion)
- Harus memicu MA-02 + warning n dibuang

---

## Hasil Acuan (SciPy / statsmodels)

| Skenario | Metode | R² | Koefisien (price) | p-value (price) | VIF (price) | Diagnostik |
|----------|--------|-----|-------------------|-----------------|-------------|------------|
| D1 | Simple | ~0.98 | ~-0.0012 | <0.001 | 1.0 | OK |
| D2 | Multiple | ~0.98 | (tidak stabil) | (tidak signifikan) | >10 | Multikolinearitas |
| D3 | Multiple | (dengan outlier) | | | | Cook's D tinggi |
| D4 | Multiple | ERROR | Singular matrix | N/A | N/A | Pre-flight block |
| D5 | Multiple | (n=6) | | | | MA-02 + n dropped |