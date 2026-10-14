'use client'

// React Imports
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

// Third-party Imports
import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, GlobeIcon, KeyRoundIcon, Share2Icon, ShieldCheckIcon, UploadIcon, UserRoundIcon, XCircleIcon } from 'lucide-react'

// Component Imports
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

// Util Imports
import { api } from '@/lib/api'

type Preset = { id: string; name: string; description: string; example_url: string; table_index: number }
type Inspect = {
  final_url: string
  tables: { index: number; rows: number; cols: number; columns: string[]; sample: Record<string, unknown>[] }[]
} | null
type Source = {
  id: string
  kind: string
  provider: string
  record_count: number | null
  dataset_id: string | null
  created_at: string
}
type Capability = {
  key: string
  label: string
  access_modes: string[]
  data_types: string[]
  default_limit: number
  max_limit: number
  needs: string[]
  note: string
}
type Connection = { provider: string; status: string; scopes: string[]; expires_at: string | null }

export type SourceJob = {
  id: string
  status: string
  stage?: string
  error?: string
  failed_stage?: string
  warnings?: string[]
} | null

type Preflight = {
  ok: boolean
  checks: { name: string; ok: boolean; detail: string }[]
  warnings: string[]
  effective: { kind: string; provider: string; access_mode: string; limit: number }
} | null

const BROWSER_PROVIDERS = ['tiktok_comments', 'instagram_comments', 'youtube_comments', 'facebook_comments', 'x_comments']

const SOSMED_META: { id: string; label: string; hint: string; placeholder: string; oauth: boolean }[] = [
  { id: 'tiktok_comments', label: 'TikTok', hint: 'Komentar video', placeholder: 'https://www.tiktok.com/@akun/video/123…', oauth: false },
  { id: 'instagram_comments', label: 'Instagram', hint: 'Komentar Post/Reels', placeholder: 'https://www.instagram.com/p/ABC…', oauth: false },
  { id: 'youtube_comments', label: 'YouTube', hint: 'Komentar video', placeholder: 'https://www.youtube.com/watch?v=…', oauth: true },
  { id: 'facebook_comments', label: 'Facebook', hint: 'Komentar postingan', placeholder: 'https://www.facebook.com/…/posts/…', oauth: false },
  { id: 'x_comments', label: 'X / Twitter', hint: 'Balasan postingan', placeholder: 'https://x.com/akun/status/…', oauth: false }
]

const ACCESS_META: Record<string, { label: string; desc: string }> = {
  public: { label: 'Tanpa koneksi akun', desc: 'Akses publik — coba dulu, tanpa login sumber.' },
  oauth: { label: 'Hubungkan akun (OAuth)', desc: 'Izin API resmi atas nama akun Anda.' },
  session: { label: 'Sesi browser', desc: 'Upload storage_state.json (konten privat).' }
}

type Props = {
  showUploadTab: boolean
  uploadSlot: ReactNode
  srcProvider: string
  setSrcProvider: (v: string) => void
  presets: Preset[]
  scrapeUrl: string
  setScrapeUrl: (v: string) => void
  advanced: boolean
  setAdvanced: (v: boolean) => void
  inspect: Inspect
  pickTable: number
  setPickTable: (v: number) => void
  srcConfig: string
  setSrcConfig: (v: string) => void
  sources: Source[]

  /** Bangun payload {kind, provider, config} atau throw Error validasi. access_mode dari state panel. */
  buildPayload: (accessMode: string) => { kind: string; provider: string; config: Record<string, unknown>; access_mode: string }
  job: SourceJob
  jobBusy: boolean
  onRun: (accessMode: string) => void
  inspectTables: () => void
  setMsg: (v: string) => void
  setErr: (v: string) => void
}

/** Baca satu kunci dari JSON config tanpa melempar. */
function cfgGet(srcConfig: string, key: string): string {
  try {
    const v = (JSON.parse(srcConfig || '{}') as Record<string, unknown>)[key]

    return v == null ? '' : String(v)
  } catch {
    return ''
  }
}

const STEPS = ['Sumber', 'Konfigurasi', 'Review'] as const

/**
 * Wizard Dataset Studio (spek §3): 1 Sumber → 2 Konfigurasi → 3 Review.
 * Aturan UX spek: publik duluan tanpa login; OAuth hanya bila dibutuhkan;
 * kombinasi tak didukung = tombol mati + penjelasan; progres job berupa
 * tahap/activity, bukan persen palsu.
 */
const DataSourcePanel = (props: Props) => {
  const {
    showUploadTab, uploadSlot,
    srcProvider, setSrcProvider, presets, scrapeUrl, setScrapeUrl,
    advanced, setAdvanced, inspect, pickTable, setPickTable,
    srcConfig, setSrcConfig, sources,
    buildPayload, job, jobBusy, onRun,
    inspectTables, setMsg, setErr
  } = props

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [picked, setPicked] = useState<string>(showUploadTab ? 'upload' : 'tiktok_comments')
  const [accessMode, setAccessMode] = useState('public')
  const [caps, setCaps] = useState<Capability[]>([])
  const [conns, setConns] = useState<Connection[]>([])
  const [preflight, setPreflight] = useState<Preflight>(null)
  const [checking, setChecking] = useState(false)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    api<Capability[]>(`/api/v1/sources/capabilities`).then(setCaps).catch(() => setCaps([]))
    refreshConns().catch(() => setConns([]))
     
  }, [])

  async function refreshConns() {
    setConns(await api<Connection[]>(`/api/v1/oauth/connections`))
  }

  const isBrowser = BROWSER_PROVIDERS.includes(picked)
  const isUpload = picked === 'upload'
  const isWeb = picked === 'web'
  const cap = caps.find(c => c.key === `${isWeb ? (srcProvider === 'html_table' ? 'scraper' : 'api') : 'scraper'}:${isWeb ? srcProvider : picked}`)
  const modes: string[] = cap?.access_modes ?? (isBrowser ? ['public', 'session'] : ['public'])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset mode akses bila tak didukung sumber terpilih; guard render-loop via includes.
    if (!modes.includes(accessMode)) setAccessMode(modes[0] ?? 'public')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, srcProvider, caps])

  function pickProvider(pv: string) {
    setSrcProvider(pv)
    setPreflight(null)

    if (BROWSER_PROVIDERS.includes(pv)) {
      setAdvanced(true)
      setSrcConfig('{\n  "url": "",\n  "limit": 100,\n  "scroll_delay_ms": 800\n}')
    } else if (pv === 'html_table') {
      setAdvanced(false)
    } else {
      setAdvanced(true)
      setSrcConfig('{\n  "url": "https://.../records",\n  "params": {"limit": 100},\n  "records_path": "data.items",\n  "mapping": {"kolom_tujuan": "path.sumber"}\n}')
    }
  }

  function selectSource(id: string) {
    setPicked(id)
    setPreflight(null)
    if (BROWSER_PROVIDERS.includes(id)) pickProvider(id)
  }

  /** Tulis satu kunci ke JSON config (tab Sosmed tanpa edit JSON). */
  function patchCfg(patch: Record<string, unknown>) {
    let cfg: Record<string, unknown> = {}

    try {
      cfg = JSON.parse(srcConfig || '{}') as Record<string, unknown>
    } catch {
      cfg = {}
    }

    setSrcConfig(JSON.stringify({ ...cfg, ...patch }, null, 2))
  }

  function onStorageFile(f: File | undefined) {
    if (!f) return
    const reader = new FileReader()

    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))

        patchCfg({ storage_state: parsed })
        setAccessMode('session')
        setMsg('Login sosmed dimuat (storage_state.json) — siap scrape.')
      } catch (e: unknown) {
        setErr('File storage_state.json tidak valid: ' + (e instanceof Error ? e.message : ''))
      }
    }

    reader.readAsText(f)
  }

  async function connectYoutube() {
    setErr('')
    setMsg('')
    setConnecting(true)

    try {
      const j = await api<{ url: string; state: string }>(`/api/v1/oauth/youtube/start`)

      window.sessionStorage.setItem('yt_return', window.location.pathname)
      window.location.href = j.url
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal memulai OAuth YouTube')
    } finally {
      setConnecting(false)
    }
  }

  async function disconnect(provider: string) {
    setErr('')
    setMsg('')

    try {
      const res = await fetch(`${(await import('@/lib/api')).apiUrl()}/api/v1/oauth/connections/${provider}`, {
        method: 'DELETE',
        headers: (await import('@/lib/api')).authHeaders()
      })

      if (res.status !== 204) throw new Error(`HTTP ${res.status}`)
      setMsg(`Koneksi ${provider} dicabut.`)
      await refreshConns()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal mencabut koneksi')
    }
  }

  async function runPreflight() {
    setErr('')
    setChecking(true)
    setPreflight(null)

    try {
      const p = buildPayload(accessMode)

      setPreflight(await api<NonNullable<Preflight>>(`/api/v1/datasets/preflight`, {
        method: 'POST',
        body: JSON.stringify({ kind: p.kind, provider: p.provider, access_mode: accessMode, config: p.config })
      }))
      setStep(3)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Preflight gagal')
    } finally {
      setChecking(false)
    }
  }

  const ytConn = conns.find(c => c.provider === 'youtube' && c.status === 'active')
  const canNext1 = isUpload || isBrowser || isWeb
  const effectiveProvider = isWeb ? srcProvider : picked

  return (
    <Card>
      <CardHeader>
        <CardTitle className='font-semibold tracking-[-0.02em]'>Sumber Data</CardTitle>
        <CardDescription>
          Tiga pintu masuk, satu hasil: dataset berversi yang siap dianalisis.
        </CardDescription>
        <ol className='flex items-center gap-1.5 pt-1' aria-label='Tahap'>
          {STEPS.map((s, i) => {
            const n = (i + 1) as 1 | 2 | 3
            const done = step > n
            const cur = step === n

            return (
              <li key={s} className='flex items-center gap-1.5'>
                <span className={`flex size-6 items-center justify-center rounded-full font-mono text-[11px] ${cur ? 'bg-primary text-primary-foreground' : done ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {done ? '✓' : n}
                </span>
                <span className={`text-xs ${cur ? 'font-semibold' : 'text-muted-foreground'}`}>{s}</span>
                {i < STEPS.length - 1 && <span className='text-muted-foreground mx-1'>→</span>}
              </li>
            )
          })}
        </ol>
      </CardHeader>
      <CardContent>
        {step === 1 && (
          <div className='space-y-3'>
            <p className='text-muted-foreground text-xs'>Pilih sumber dulu. Akun hanya perlu dihubungkan bila sumber/endpoint memerlukannya.</p>
            <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
              {showUploadTab && (
                <button type='button' onClick={() => selectSource('upload')} aria-pressed={picked === 'upload'}
                  className={`rounded-lg border px-2 py-3 text-center transition ${picked === 'upload' ? 'border-primary bg-primary/10 font-semibold' : 'hover:border-primary/50 hover:bg-muted/50'}`}>
                  <UploadIcon className='mx-auto size-4' />
                  <span className='mt-1 block text-xs'>Upload File</span>
                  <span className='text-muted-foreground block text-[10px]'>CSV/Excel/JSON</span>
                </button>
              )}
              {SOSMED_META.map(s => (
                <button key={s.id} type='button' onClick={() => selectSource(s.id)} aria-pressed={picked === s.id}
                  className={`rounded-lg border px-2 py-3 text-center transition ${picked === s.id ? 'border-primary bg-primary/10 font-semibold' : 'hover:border-primary/50 hover:bg-muted/50'}`}>
                  <Share2Icon className='mx-auto size-4' />
                  <span className='mt-1 block text-xs'>{s.label}</span>
                  <span className='text-muted-foreground block text-[10px]'>{s.hint}</span>
                </button>
              ))}
              <button type='button' onClick={() => selectSource('web')} aria-pressed={picked === 'web'}
                className={`rounded-lg border px-2 py-3 text-center transition ${picked === 'web' ? 'border-primary bg-primary/10 font-semibold' : 'hover:border-primary/50 hover:bg-muted/50'}`}>
                <GlobeIcon className='mx-auto size-4' />
                <span className='mt-1 block text-xs'>Web / API</span>
                <span className='text-muted-foreground block text-[10px]'>Tabel HTML / REST</span>
              </button>
            </div>
            <div className='flex justify-end'>
              <Button onClick={() => setStep(2)} disabled={!canNext1}>
                Lanjut ke Konfigurasi
                <ArrowRightIcon />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className='space-y-4'>
            {isUpload ? (
              uploadSlot
            ) : (
              <>
                <Field className='gap-2'>
                  <FieldLabel>Metode akses</FieldLabel>
                  <div className='grid gap-2 sm:grid-cols-3'>
                    {Object.entries(ACCESS_META).map(([m, meta]) => {
                      const supported = modes.includes(m)
                      const active = accessMode === m

                      return (
                        <button key={m} type='button' disabled={!supported} onClick={() => { setAccessMode(m); setPreflight(null) }}
                          aria-pressed={active} title={supported ? meta.desc : 'Tidak didukung sumber ini'}
                          className={`rounded-lg border px-3 py-2.5 text-left transition ${active ? 'border-primary bg-primary/10' : ''} ${supported ? 'hover:border-primary/50' : 'cursor-not-allowed opacity-40'}`}>
                          <span className='flex items-center gap-1.5 text-xs font-semibold'>
                            {m === 'public' ? <GlobeIcon className='size-3.5' /> : m === 'oauth' ? <ShieldCheckIcon className='size-3.5' /> : <KeyRoundIcon className='size-3.5' />}
                            {meta.label}
                          </span>
                          <span className='text-muted-foreground mt-0.5 block text-[11px] leading-snug'>
                            {supported ? meta.desc : 'Tidak didukung sumber ini.'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {cap?.note && <p className='text-muted-foreground text-xs leading-relaxed'>ⓘ {cap.note}</p>}
                </Field>

                {accessMode === 'oauth' && (
                  <div className='space-y-2 rounded-lg border p-3'>
                    <p className='text-xs font-semibold'>Koneksi akun (terpisah dari login aplikasi)</p>
                    {conns.length === 0 && <p className='text-muted-foreground text-xs'>Belum ada koneksi tersimpan.</p>}
                    {conns.map(c => (
                      <div key={c.provider} className='flex items-center gap-2 text-xs'>
                        <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.provider}</Badge>
                        <span className='text-muted-foreground truncate'>{c.status}{c.scopes.length > 0 && ` · ${c.scopes.join(', ')}`}</span>
                        <Button variant='ghost' size='sm' className='ml-auto h-7 text-xs' onClick={() => void disconnect(c.provider)}>
                          Cabut
                        </Button>
                      </div>
                    ))}
                    {effectiveProvider === 'youtube_comments' || effectiveProvider === 'youtube' ? (
                      ytConn ? (
                        <p className='text-xs text-primary'>✓ YouTube terhubung — mode OAuth siap dipakai.</p>
                      ) : (
                        <Button variant='outline' size='sm' disabled={connecting} onClick={() => void connectYoutube()}>
                          {connecting ? 'Membuka Google…' : 'Hubungkan YouTube'}
                        </Button>
                      )
                    ) : (
                      <p className='text-muted-foreground text-xs leading-relaxed'>
                        OAuth {SOSMED_META.find(s => s.id === effectiveProvider)?.label ?? effectiveProvider} belum tersedia —
                        pakai mode publik atau sesi browser untuk sumber ini.
                      </p>
                    )}
                  </div>
                )}

                {isBrowser && (
                  <div className='space-y-3'>
                    <Field className='gap-2'>
                      <FieldLabel htmlFor='sosmed-url'>Link {SOSMED_META.find(s => s.id === picked)?.label}</FieldLabel>
                      <Input id='sosmed-url' className='rounded-lg' inputMode='url'
                        placeholder={SOSMED_META.find(s => s.id === picked)?.placeholder}
                        value={cfgGet(srcConfig, 'url')} onChange={e => patchCfg({ url: e.target.value })} />
                    </Field>
                    <div className='grid gap-3 sm:grid-cols-2'>
                      <Field className='gap-2'>
                        <FieldLabel htmlFor='sosmed-limit'>Jumlah (limit)</FieldLabel>
                        <Input id='sosmed-limit' className='rounded-lg' inputMode='numeric'
                          value={cfgGet(srcConfig, 'limit') || '100'}
                          onChange={e => { const n = Number(e.target.value);

 patchCfg({ limit: Number.isFinite(n) && n > 0 ? Math.floor(n) : 100 }) }} />
                      </Field>
                      {accessMode === 'session' && (
                        <Field className='gap-2'>
                          <FieldLabel htmlFor='sosmed-login'>File login (storage_state.json)</FieldLabel>
                          <Input id='sosmed-login' type='file' accept='.json,application/json' className='rounded-lg text-xs'
                            onChange={e => onStorageFile(e.target.files?.[0])} />
                        </Field>
                      )}
                    </div>
                    {accessMode === 'session' && (
                      <p className='text-muted-foreground text-xs leading-relaxed'>
                        Login sekali di browser, export storage_state.json, unggah di sini.
                        {cfgGet(srcConfig, 'storage_state') && <span className='font-medium text-primary'> ✓ login terpasang</span>}
                      </p>
                    )}
                  </div>
                )}

                {isWeb && (
                  <div className='space-y-2'>
                    <Select value={srcProvider} onValueChange={v => pickProvider(v ?? 'generic_rest')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value='generic_rest'>API generik (REST JSON)</SelectItem>
                        <SelectItem value='youtube'>YouTube Data API (OAuth/API key)</SelectItem>
                        <SelectItem value='html_table'>Scraper tabel HTML (allowlist)</SelectItem>
                      </SelectContent>
                    </Select>
                    {(srcProvider === 'html_table' && !advanced) ? (
                      <>
                        <select aria-label='Preset' className='border-input w-full rounded-lg border px-3 py-2 text-sm' value=''
                          onChange={e => { const pr = presets.find(x => x.id === e.target.value);

 if (pr) setScrapeUrl(pr.example_url) }}>
                          <option value=''>— Pilih preset (opsional) —</option>
                          {presets.map(pr => <option key={pr.id} value={pr.id}>{pr.name} — {pr.description}</option>)}
                        </select>
                        <div className='flex gap-2'>
                          <Input placeholder='https://domain-allowlisted/halaman' className='rounded-lg' value={scrapeUrl}
                            onChange={e => setScrapeUrl(e.target.value)} aria-label='URL halaman' />
                          <Button type='button' variant='secondary' onClick={() => void inspectTables()}>Cek tabel</Button>
                        </div>
                        {inspect && (
                          <div className='space-y-2'>
                            {inspect.tables.map(t => (
                              <label key={t.index} className='flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm'>
                                <input type='radio' name='picktable' checked={pickTable === t.index} onChange={() => setPickTable(t.index)} className='mt-1' />
                                <span><strong>Tabel {t.index}</strong> — {t.rows}×{t.cols} · {t.columns.slice(0, 6).join(', ')}</span>
                              </label>
                            ))}
                            {inspect.tables.length === 0 && <p className='text-muted-foreground text-xs'>Tidak ada tabel di halaman ini.</p>}
                          </div>
                        )}
                      </>
                    ) : (
                      <Textarea rows={6} className='rounded-lg font-mono text-xs' value={srcConfig} onChange={e => setSrcConfig(e.target.value)} />
                    )}
                  </div>
                )}
              </>
            )}

            <div className='flex items-center justify-between'>
              <Button variant='ghost' size='sm' onClick={() => setStep(1)}>
                <ArrowLeftIcon /> Kembali
              </Button>
              {!isUpload && (
                <Button onClick={() => void runPreflight()} disabled={checking}>
                  {checking ? 'Memeriksa…' : 'Cek kelayakan → Review'}
                  <ArrowRightIcon />
                </Button>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className='space-y-4'>
            {!preflight ? (
              <p className='text-muted-foreground text-sm'>Jalankan “Cek kelayakan” dulu dari tahap Konfigurasi.</p>
            ) : (
              <>
                <ul className='space-y-1.5'>
                  {preflight.checks.map(c => (
                    <li key={c.name} className='flex items-start gap-2 text-xs'>
                      {c.ok ? <CheckCircle2Icon className='mt-0.5 size-4 shrink-0 text-primary' /> : <XCircleIcon className='mt-0.5 size-4 shrink-0 text-destructive' />}
                      <span><strong className='font-medium'>{c.name}:</strong> <span className='text-muted-foreground'>{c.detail}</span></span>
                    </li>
                  ))}
                </ul>
                {preflight.warnings.length > 0 && (
                  <Alert><AlertDescription><ul className='list-disc pl-4 text-xs'>{preflight.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></AlertDescription></Alert>
                )}
                <div className='rounded-lg border p-3 font-mono text-[11px]'>
                  {preflight.effective.provider} · {preflight.effective.access_mode} · limit {preflight.effective.limit}
                </div>
              </>
            )}

            {job && (
              <div className='space-y-2 rounded-lg border p-3'>
                <div className='flex items-center gap-2 text-xs font-semibold'>
                  <UserRoundIcon className='size-3.5' />
                  Job {job.id.slice(0, 8)} — {
                    job.status === 'completed' ? 'Selesai' :
                    job.status === 'partial' ? 'Selesai sebagian' :
                    job.status === 'failed' ? 'Gagal' :
                    job.status === 'cancelled' ? 'Dibatalkan' :
                    { queued: 'Antre', validating: 'Memvalidasi', running: 'Mengambil data', normalizing: 'Normalisasi' }[job.status] ?? job.status
                  }
                </div>
                {!['completed', 'partial', 'failed', 'cancelled'].includes(job.status) && (
                  <Progress value={null} className='h-1.5 animate-pulse' aria-label='Job berjalan' />
                )}
                {job.stage && <p className='text-muted-foreground font-mono text-[11px]'>tahap: {job.stage}</p>}
                {job.error && <p className='text-destructive text-xs'>{job.failed_stage ? `[${job.failed_stage}] ` : ''}{job.error}</p>}
                {job.warnings && job.warnings.length > 0 && (
                  <ul className='text-muted-foreground list-disc pl-4 text-xs'>{job.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                )}
              </div>
            )}

            <div className='flex items-center justify-between'>
              <Button variant='ghost' size='sm' onClick={() => setStep(2)}>
                <ArrowLeftIcon /> Kembali
              </Button>
              <Button onClick={() => onRun(accessMode)} disabled={!preflight?.ok || jobBusy}>
                {jobBusy ? 'Menjalankan…' : job ? 'Jalankan ulang' : 'Jalankan pengambilan data'}
              </Button>
            </div>
          </div>
        )}

        {sources.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sumber</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Dataset</TableHead>
                <TableHead>Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map(x => (
                <TableRow key={x.id}>
                  <TableCell>{x.kind}:{x.provider}</TableCell>
                  <TableCell>{x.record_count ?? '-'}</TableCell>
                  <TableCell className='text-muted-foreground font-mono text-[11px]'>{x.dataset_id?.slice(0, 8) || '-'}</TableCell>
                  <TableCell className='text-muted-foreground font-mono text-[11px]'>{x.created_at}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export default DataSourcePanel
