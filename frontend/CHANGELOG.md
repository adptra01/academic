<!-- Available h3 headings: Added, Fixed, Updated, Removed, Deprecated -->

# Changelog Academic

## [2026-10-09] — Migrasi frontend ke template AdminCN v1.0.0
- Basis `frontend/` diganti ke template AdminCN (Next.js 16 + React 19 + shadcn, instal via npm lokal + `echarts`, `echarts-for-react`, `katex`); token petrol `#0e5f63` dijadikan `--primary`/`--ring` templatenya agar identitas merek tetap; token lama (`paper/ink/rule/accent/danger/warn`, `.tnum`, `.pressable`, tekstur, keyframes) dipetakan sebagai alias di `globals.css`
- Seluruh fitur di-port: landing + `/metode` + `/alur` + `/reproduksi` (grup `(public)`), login + register + callback Google (`(blank)`), dashboard, project 6-tahap + stepper, halaman hasil analisis (KaTeX + ECharts + PNG), shared link read-only (`(pages)`)
- Shell template disesuaikan: nav sidebar → Penelitian (Dashboard/Metode/Alur/Reproduksi), brand "Academic / Research Platform", footer produk, ProfileDropdown membaca sesi JWT lokal + logout, tombol Star/GitHub + pemilih bahasa demo dibuang; halaman demo template (orders/apps/forms/datatable/user/mail/calendar) + `fake-db` + `api/nav-apps` dihapus
- Perilaku dipertahankan: JWT di localStorage, `apiUrl()` default `:8100` + `fetchWithContext()`, `useParams()` untuk rute dinamis (Next 16), `Select` onValueChange null-safe, CSS KaTeX di root layout
- Insiden pasca-restart: container `db` mati lagi → login 500 ("Internal Server Error") sementara `/health` 200; sembuh dengan `ddev start` (pola sama seperti insiden "Failed to fetch")
- Verified: `tsc` bersih, `next build` 11/11, login → dashboard (data nyata) → project stepper → halaman analisis di browser, mobile 390px tanpa overflow (dashboard + project)
- Backup frontend lama: `/mnt/DiskD/Workspace/Backups/academic-frontend-pre-admincn-20261009-0039.tar.gz`; riwayat changelog lama tersimpan di `CHANGELOG-ACADEMIC.md`

# Changelog (template asli, dipertahankan untuk referensi)

## v1.0.0 (2026-07-10)

### Added

#### Initial release

- Dashboard
  - Orders Dashboard
- Apps
  - Mail
  - Calendar
  - Users
- Pages
  - User Settings
  - User Profile
  - Login Page
  - Register Page
  - Forgot Password Page
  - Verify Email Page
  - Reset Password Page
  - Two Steps Verification Page
  - Error Page
- Forms & Tables
  - Form Layouts
  - Form Validation
  - Data Table
