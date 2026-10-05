# Akuisisi Media Sosial — matriks platform

Prinsip: **OAuth dulu, API resmi dulu, scraping terakhir — dan hanya yang patuh ToS.**

| Platform | Jalur | Status |
|---|---|---|
| YouTube Data API | `api:youtube` + API key atau OAuth (`use_oauth`) | ✅ Implementasi (pustaka resmi `google-api-python-client`) |
| API JSON generik | `api:generic_rest` (+ `use_oauth` bila perlu token) | ✅ Implementasi |
| X / Twitter | API v2 (berbayar) atau OAuth app sendiri | ⏳ Butuh kredensial user; pola sama seperti YouTube |
| TikTok Research API | Memerlukan approval TikTok | ⏳ Butuh kredensial + approval |
| Instagram Graph | Memerlukan Meta app review | ⏳ Butuh kredensial + review |
| Scraping langsung medsos | **DITOLAK oleh scraping-policy** (bypass auth/ToS) | ❌ Tak dibangun |

## YouTube: cara pakai

1. Google Cloud → aktifkan YouTube Data API v3 → buat API key (batas kuota 10rb unit/hari),
   ATAU OAuth client (web) dengan redirect ke aplikasi.
2. Import: provider `youtube`, config:
   `{"query": "literasi digital", "max_results": 25, "order": "relevance"}`
   + `{"api_key": "..."}` ATAU simpan token via `POST /oauth/connections`
   lalu tambah `"use_oauth": true` di config fetch.
3. Refresh token kedaluwarsa via `POST /oauth/connections/{provider}/refresh`
   (pakai requests-oauthlib; butuh token_endpoint + client_id/secret).
4. Setiap fetch mencatat provenance (query, hash, jumlah) ke dataset version.

Kuota: search.list ±100 unit/panggil — `max_pages` dibatasi 5.
