<!-- Available h3 headings: Added, Fixed, Updated, Removed, Deprecated -->

# Changelog Academic

## [2026-10-10] — Redesain UI mengikuti referensi ngulikdata.com
- Bahasa desain diekstrak langsung dari DOM https://ngulikdata.com/ (screenshot tidak dapat dibaca model): font Geist + Geist Mono; primer biru pekat `oklch(0.204 0.2 271)` (identik dengan tombol referensi, diverifikasi via computed style); netral hangat (hue 78) `base-200 oklch(0.968 0.005 78)` / border `oklch(0.88 0.01 78)`; radius 12px; H1/H2 `font-bold tracking-[-0.04em] leading-[0.98]`; label mikro uppercase mono `tracking-[0.2em]`; tombol pil `rounded-full` + hover lift `-translate-y-0.5`; header sticky 72px `bg-paper/70 backdrop-blur-sm` tanpa border; hero dot-grid 22px; section berselang putih / off-white hangat tanpa border; blok CTA penutup biru penuh; footer hangat
- `globals.css`: palet `:root`/.dark diganti ke token hangat + primer biru; `--radius` 0.75rem; alias lama (paper/ink/rule/accent/abyss/warn) dipertahankan agar komponen hasil port tetap jalan; `.graph-paper`/`.graph-paper-fade` → `.dot-grid`/`.dot-grid-fade`; `.grain-layer`, `.font-editorial`, `--font-archivo` dihapus; `.tnum` kini murni Geist Mono
- `layout.tsx`: impor font Archivo + IBM Plex Mono dibuang (tidak terpakai) — hanya Geist + Geist Mono
- Primitif: `ui/button.tsx` → pil (`rounded-full`, `font-semibold`, hover lift, aktif scale 0.98); tinggi default/sm/lg disesuaikan
- Halaman publik: `site-header` (transparan 72px), `public-nav` (hover pil), `nav-parts` (CTA pil), `hero` (H1 lebih besar/tebal, blob petrol dibuang → dot-grid), `page-header`, `closing-cta` (blok biru penuh + dot overlay putih), `site-footer`, `wordmark`, dan 9 komponen section (methods-summary, workflow-core, pipeline, provenance, audience, formats, validation-evidence, methods-index, analysis-receipt): border section dihapus, ritme `py-24 lg:py-32`, heading bold, label mikro mono, kartu `rounded-xl`, chip pil
- Console + auth: `layout/Header` jadi sticky transparan `bg-paper/70 backdrop-blur-sm` tanpa border; label grup `Sidebar` mono; judul view dashboard/project/analysis/shared + login/register/callback → bold tight-tracked; kartu `rounded-xl`, input `rounded-lg`
- **Fix arsitektur (bug pra-existing)**: `SidebarProvider` dipindah dari `Providers` (root, membungkus SEMUA rute) ke `layout` grup `(pages)`. Sebelumnya wrapper `flex min-h-svh w-full` dari shadcn membungkus halaman publik & auth sebagai flex-row → header/main/footer tampil BERDAMPINGAN secara horizontal (scrollWidth 1939px pada viewport 1280px). Setelah fix: halaman publik & auth tersusun vertikal normal (scrollWidth = viewport), shell aplikasi `(pages)` tetap utuh (sidebar 256px + header transparan 64px)
- Verified: `tsc` bersih; `next build` 11/11; via agent-browser — `/`, `/metode`, `/alur`, `/reproduksi`, `/login`, `/register` tanpa overflow horizontal (desktop 1440 & mobile 390), tanpa console error, menu burger mobile berfungsi; `/dashboard` tanpa sesi → redirect `/login`; `/shared/<token>` merender shell aplikasi; token & gaya terverifikasi via computed style (primer `oklch(0.204 0.2 271)`, radius, dot-grid, section berselang, CTA biru, footer, tombol pil, label mono)
- Console (setelah auth): sidebar 256px + header 64px transparan tanpa border, tanpa overflow; judul `Dashboard`/project 30px/700/−0.9px; kartu `rounded-xl` 16.8px; input `rounded-lg` 12px; tombol pil (aksi primer biru, sekunder outline putih); label mikro mono (mis. "Tahap 02"); mobile 390 tanpa overflow
- **Blocker verifikasi (pra-existing, bukan dari perubahan ini)**: container `ddev-academic-db` mati → `POST /api/v1/auth/login` 500 "Internal Server Error" padahal `/health` 200 (backend gagal resolve host `db`). Dipulihkan dengan `ddev start` (init.sql jalan ulang, DB fresh) → QA console dijalankan. Akun demo `demo@kampus.ac.id` / `Demo12345` (sesuai `docs/beta-guide.md`) dibuat ulang + 1 project uji "QA Redesain — Contoh Penelitian" (boleh dihapus dari dashboard)
- Backup pra-redesain (dari git HEAD `7bee79a`): `/mnt/DiskD/Workspace/Backups/academic-frontend-pre-redesign-ngulikdata-20261010-1510.tar.gz`

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

## 2026-10-10 — Desain light & dark mode + pembersihan

### Added
- Mode terang/gelap penuh: `next-themes` (`attribute='class'`, `defaultTheme='system'`), token `.dark` disempurnakan, `color-scheme` terdefinisi per mode.
- `ModeToggle` publik di header dan di panel mobile.
- Token semantik baru: `--brand`/`--brand-foreground`, `--strong`/`--strong-foreground`, `--strong-accent`, `--shadow-card` (tema-sadar).
- `EChartView` sadar tema: warna axis/grid/label/bar/line dibaca dari variabel CSS dan bereaksi pada perubahan tema.

### Changed
- Panel `Provenance` (reproduksi) tetap gelap di kedua mode menggunakan token `strong`, aksen terang (strong-accent) untuk keterbacaan, border dan opacity diadaptasi.
- `ClosingCTA` pakai token `brand` agar blok CTA biru tetap stabil di mode gelap.
- `AnalysisReceipt`: `bg-white/*` → `bg-card/*`, bayangan karti tema-sadar, skeleton pakai `bg-muted`, sheen `shimmer` berbasis `--foreground`.
- Komponen publik dimigrasi dari `accent*` ke `primary*`; alias `accent→primary` lama dihapus agar semantik `accent` shadcn kembali normal (memperbaiki hover dropdown/select).
- `html` diberi `bg-background`, `.caret::after` pakai `currentColor`, `::selection` konsisten.
- Penyesuaian kecil token `warn`/`warn-wash` dan `accent-wash` agar siap tema.

### Removed
- Komponen UI tidak terpakai: `background-ripple`, `button-group`, `chart`, `checkbox`, `circular-progress`, `combobox`, `command`, `input-otp`, `pagination`, `popover`, `radio-group`, `rating`, `resizable`, `scroll-area`, `switch`, `timeline`, `toggle-group`.
- CSS mati: `.hatch`, `.animate-marquee`, `@keyframes marquee-x`, `.input-default/.input-lg/.input-sm/.input-size-lg`, alias `--color-paper-4`, `--color-abyss*`, override `accent*→primary*` yang berlebihan.
- Dependensi yatim/dihapus: `cmdk`, `input-otp`, `react-resizable-panels`, `recharts`, `@hookform/resolvers`, `@tanstack/react-table`, `react-hook-form`, `zod`.

### Fixed
- Konsistensi mode gelap di halaman publik (hero/nav/methods/analysis-receipt/provenance/CTA), kontras label pada panel gelap.
- Hover `dropdown-menu`/`select` kembali terbaca setelah memulihkan semantik `accent` shadcn.
