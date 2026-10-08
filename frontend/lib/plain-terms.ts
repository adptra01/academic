/**
 * Kamus bahasa sehari-hari.
 *
 * Istilah teknis (`dataset`, `preprocess`, `diff`, `t-test`) tetap dipakai di
 * URL, kode, dan nama API karena itu kontrak dengan mesin. Yang diganti hanya
 * label yang dilihat pengguna umum — supaya tidak ada dua kosakata berbeda untuk
 * satu hal yang sama.
 *
 * Aturan: label memakai kata yang dipakai dosen saat menjelaskan ke mahasiswa,
 * bukan istilah implementasi.
 */

/** Tab project → label yang dimengerti orang awam. */
export const TAB_LABEL: Record<string, string> = {
  dataset: "Lihat Data",
  variables: "Atur Kolom",
  preprocess: "Bersihkan Data",
  diff: "Bandingkan Versi",
  analysis: "Jalankan Analisis",
  log: "Riwayat Analisis",
  exports: "Unduh Hasil",
};

/** Penjelasan singkat tiap tab — tampil sebagai subjudul agar tak tertebak. */
export const TAB_HINT: Record<string, string> = {
  dataset: "Periksa data yang sudah diunggah sebelum dianalisis.",
  variables: "Tentukan jenis setiap kolom dan perannya dalam penelitian.",
  preprocess:
    "Hapus baris dengan data kosong, buang nilai yang terlalu jauh berbeda, lalu rapikan kolom. File asli tetap utuh.",
  diff: "Lihat apa yang berubah antara dua versi data.",
  analysis: "Pilih metode statistik dan jalankan. Asumsi diperiksa otomatis.",
  log: "Semua analisis yang pernah dijalankan, lengkap dengan cap integritasnya.",
  exports: "Unduh hasil ke PDF, Word, Excel, atau TEX untuk keperluan naskah.",
};

/** Istilah teknis → bahasa sehari-hari, untuk dipakai inline di teks bantuan. */
export const PLAIN_TERM: Record<string, string> = {
  dataset: "file data",
  version: "versi",
  variable: "kolom",
  preprocessing: "pembersihan data",
  analysis: "analisis",
  export: "unduhan",
  diff: "perbandingan",
  profile: "gambaran umum data",
  role: "peran",
  effect_size: " besar efek",
  assumption: "asumsi",
  provenance: "asal-usul data",
  hash: "cap integritas",
  log: "riwayat",
  method: "metode",
  format: "format",
  source: "sumber",
};

/** Label tombol: menyebut kata kerja + objeknya, bukan nama internal. */
export const ACTION_LABEL = {
  createProject: "Buat Project Baru",
  openProject: "Buka Project",
  uploadDataset: "Unggah File Data",
  deleteDataset: "Hapus File Data",
  importFromWeb: "Ambil Data dari Web",
  addOperation: "Tambahkan Langkah Bersihkan",
  runOperations: "Jalankan Pembersihan",
  runAnalysis: "Jalankan Analisis",
  compareVersions: "Bandingkan Dua Versi",
  downloadLog: "Unduh Riwayat (CSV)",
  changePassword: "Simpan Password Baru",
} as const;

/** Kata bantu untuk field yang sering membingungkan. */
export const FIELD_HELP: Record<string, string> = {
  title: "Tulis judul penelitian Anda, misalnya “Hubungan Motivation dan Prestasi”. Bisa diubah nanti.",
  description: "Catatan bebas: hipotesis, sumber data, atau metode yang dipakai.",
  research_type: "Menentukan format laporan dan gaya sitasi yang disarankan.",
  file: "Pilih satu file. Ukuran maksimal 50 MB.",
  column: "Tulis nama kolom persis seperti yang muncul di file Anda.",
  method: "Pilih metode yang sesuai dengan pertanyaan penelitian Anda.",
  from: "Versi lama.",
  to: "Versi baru setelah dibersihkan.",
};

/** Tooltip singkat untuk badge/marker yang mungkin membingungkan. */
export const STATUS_HELP: Record<string, string> = {
  aktif: "File data ini yang sedang dipakai di semua analisis.",
  fase2: "Metode ini masih dikerjakan, belum tersedia.",
  tersedia: "Bisa langsung dipakai.",
};