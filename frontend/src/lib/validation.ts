/**
 * Helper validasi client-side bersama (aturan 9.1 skill: satu modul kanonis,
 * bukan duplikasi per form). Setiap fungsi mengembalikan pesan galat Bahasa
 * Indonesia atau `null` bila valid. Backend tetap sumber kebenaran terakhir —
 * ini hanya agar pengguna tahu salahnya SEBELUM request dikirim.
 */

/** Email wajib diisi dan berbentuk email. */
export function validEmail(v: string): string | null {
  const s = v.trim()

  if (!s) return 'Email wajib diisi.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return 'Format email tidak valid (mis. nama@kampus.ac.id).'

  return null
}

/** Teks wajib diisi (label dipakai di pesan). */
export function validRequired(v: string, label: string): string | null {
  if (!v.trim()) return `${label} wajib diisi.`

  return null
}

/** Panjang minimal (label dipakai di pesan). */
export function validMinLength(v: string, min: number, label: string): string | null {
  if (v.length < min) return `${label} minimal ${min} karakter.`

  return null
}

/** URL http(s) wajib — untuk form scrape. */
export function validHttpUrl(v: string, label = 'URL'): string | null {
  const s = v.trim()

  if (!s) return `${label} wajib diisi.`

  try {
    const u = new URL(s)

    if (u.protocol !== 'http:' && u.protocol !== 'https:') return `${label} harus diawali http:// atau https://.`
  } catch {
    return `${label} tidak valid (mis. https://contoh.com/halaman).`
  }

  return null
}

/** Bilangan bulat positif — untuk nomor versi diff. */
export function validPositiveInt(v: string, label: string): string | null {
  if (!/^\d+$/.test(v.trim()) || Number(v) < 1) return `${label} harus angka 1, 2, 3, …`

  return null
}

/** Ambil file dari FormData; null bila tidak ada file yang dipilih. */
export function formFile(fd: FormData, key: string): File | null {
  const f = fd.get(key)

  return f instanceof File && f.size > 0 ? f : null
}
