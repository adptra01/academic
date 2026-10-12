# Scenario E: Data Bermasalah (Data Quality Issues)

## Desain Penelitian
**Tujuan**: Menguji ketahanan platform terhadap masalah kualitas data yang umum dalam penelitian nyata.
**Variabel**: Campuran numerik, kategorikal, ID, teks.

## Dataset Uji

### E1: Missing Values (Bervariasi)
```csv
id,group,score,text_field
1,A,10,good
2,B,
3,A,15,excellent
4,B,12,
5,A,,average
6,B,8,poor
7,A,20,good
8,B,18,excellent
```
- Missing di `group` (baris 2), `score` (baris 5), `text_field` (baris 4)
- Harus memicu MA-02 untuk kolom terpilih

### E2: ID Duplikat
```csv
id,group,score
1,A,10
2,B,12
2,B,12
3,A,15
4,B,8
5,A,20
```
- ID 2 duplikat → MA-01
- Baris 3 identik duplikat (whole row) → duplicate_rows

### E3: Baris Identik (Whole Row Duplicates)
```csv
id,group,score
1,A,10
2,B,12
3,A,15
3,A,15
4,B,8
5,A,20
```
- Baris 3 & 4 identik → `duplicate_rows` di profile

### E4: Tipe Data Campuran (String di Kolom Numerik)
```csv
id,score
1,10
2,12
3,15
4,abc
5,20
6,18
```
- Baris 4: "abc" di kolom numerik → parsing error / coerce to NaN
- Harus ditangani saat upload/profile

### E5: Kolom Konstan (Zero Variance)
```csv
id,group,score
1,A,10
2,A,12
3,A,15
4,A,8
5,A,20
```
- `group` konstan "A" → tidak bisa dipakai sebagai pengelompok
- Harus memicu MA-04 (grup <2 level) jika dipilih sebagai group

### E6: Pencilan Ekstrem (Outlier)
```csv
id,score
1,10
2,12
3,15
4,1000
5,20
6,18
7,11
8,13
```
- Baris 4: 1000 (outlier ekstrem)
- Harus memicu MA-05 (IQR outlier >5%)

### E7: Skala Likert Terdeteksi Sebagai Numerik
```csv
id,q1,q2,q3
1,5,4,5
2,4,3,4
3,5,5,5
4,3,2,3
5,4,4,4
6,2,1,2
7,5,5,4
8,1,2,1
```
- q1, q2, q3: bilangan bulat 1..5, sedikit nilai unik
- Harus memicu MA-06 → sarankan set Ordinal

### E8: Kombinasi Semua Masalah
```csv
id,group,score,rating,text
1,A,10,5,good
2,B,12,4,
2,B,12,4,excellent
3,A,15,5,good
4,B,,3,average
5,A,20,5,excellent
6,B,8,2,poor
7,A,1000,5,good
8,A,18,4,average
```
- ID duplikat (2)
- Missing (baris 4 score, baris 2 text)
- Baris duplikat (2 & 3)
- Outlier (baris 7: 1000)
- Likert rating (1..5)
- Harus memicu MA-01, MA-02, MA-05, MA-06 sekaligus

---

## Hasil yang Diharapkan

| Skenario | MA yang Dipicu | Aksi Pre-flight | Perilaku Analisis |
|----------|----------------|-----------------|-------------------|
| E1 | MA-02 | Warning missing | n_dropped di result |
| E2 | MA-01 | Warning ID duplikat | Analisis jalan, warning |
| E3 | — | Info duplicate_rows | Analisis jalan |
| E4 | — | Error parsing / coerce | Upstream: profile error |
| E5 | MA-04 | Blokir jika dipilih grup | Pre-flight block |
| E6 | MA-05 | Warning outlier | Analisis jalan, switch_to |
| E7 | MA-06 | Warning Likert | Saran set Ordinal |
| E8 | MA-01,02,05,06 | Multiple warnings | Semua tercetak di result |

> **Catatan**: Data E4 (tipe campuran) seharusnya ditangani saat upload/profiling — kolom `score` terdeteksi `Text` bukan `Numerical`, sehingga tidak bisa dipilih untuk metode numerik tanpa konversi manual di panel Variabel.