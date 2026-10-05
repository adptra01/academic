# Scraping Policy (mengikat, Fase 13)

1. Prioritas sumber data TETAP: Upload → API resmi → OAuth → scraping.
2. Scraping hanya untuk halaman publik; allowlist domain wajib (`SCRAPER_ALLOWLIST`).
3. WAJIB patuhi robots.txt (tolak bila Disallow / tak terbaca).
4. DILARANG bypass login, paywall, CAPTCHA, atau restriksi API/auth apa pun.
   HTTP 401/403 atau form login → tolak dengan pesan, JANGAN coba lagi.
5. Guardrail teknis: min interval antar-request, timeout, retry ≤5,
   User-Agent teridentifikasi, raw hash, request log, dedup, provenance.
6. Setiap fetch tercatat: URL final, waktu, byte, hash — dapat diaudit.
7. Pelanggaran = defect kritis, setara kebocoran data.
