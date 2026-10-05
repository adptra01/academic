# Login dengan Google (OAuth2)

## Setup (sekali, oleh admin)

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web).
2. Authorized redirect URIs:
   - dev: `http://localhost:3100/auth/callback`
   - prod: `https://domain-anda/auth/callback`
3. Isi env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
4. Tanpa env tersebut, tombol Google menampilkan 501 yang jelas (tidak crash).

## Alur

Login → "Login dengan Google" → Google (pilih akun) → `/auth/callback?code=...`
→ backend tukar code → verifikasi ID token (pustaka resmi `google-auth`) →
find-or-create user → sesi JWT internal (cookie HttpOnly, sama seperti login biasa).

## Keamanan

- Auto-link HANYA bila `email_verified=true` dari Google.
- User OAuth memakai `password_hash = "oauth:google:<sub>"` — login password
  untuk akun ini selalu gagal (bcrypt tak cocok), jadi tak bisa diambil alih.
- Token Google TIDAK disimpan; hanya identitas yang dipakai untuk sesi internal.
- Rate-limit 10/menit seperti login biasa.
