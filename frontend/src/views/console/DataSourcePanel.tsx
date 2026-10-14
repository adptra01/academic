'use client'

// React Imports
import type { ReactNode } from 'react'

// Third-party Imports
import { GlobeIcon, Share2Icon, UploadIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

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

const BROWSER_PROVIDERS = ['tiktok_comments', 'instagram_comments', 'youtube_comments', 'facebook_comments', 'x_comments']

const SOSMED_META: { id: string; label: string; hint: string; placeholder: string }[] = [
  { id: 'tiktok_comments', label: 'TikTok', hint: 'Komentar video TikTok', placeholder: 'https://www.tiktok.com/@akun/video/123…' },
  { id: 'instagram_comments', label: 'Instagram', hint: 'Komentar Post/Reels', placeholder: 'https://www.instagram.com/p/ABC…' },
  { id: 'youtube_comments', label: 'YouTube', hint: 'Komentar video', placeholder: 'https://www.youtube.com/watch?v=…' },
  { id: 'facebook_comments', label: 'Facebook', hint: 'Komentar postingan', placeholder: 'https://www.facebook.com/…/posts/…' },
  { id: 'x_comments', label: 'X / Twitter', hint: 'Balasan postingan', placeholder: 'https://x.com/akun/status/…' }
]

type Props = {

  /** Tab awal. Di halaman kosong: 'upload'. Di tab dataset: 'sosmed'. */
  defaultTab?: 'upload' | 'sosmed' | 'web'

  /** Tampilkan tab unggah file (hanya relevan sebelum dataset ada). */
  showUploadTab: boolean

  /** Form upload file yang sudah ada — dipindah ke dalam tab tanpa diubah. */
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
  fetchSource: (e: React.FormEvent) => void
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

/**
 * Satu panel untuk SEMUA pintu masuk data: file, sosmed (browser scraper +
 * login via `storage_state.json`), dan web/API. Dipakai di state kosong
 * (sebelum dataset ada) maupun di tab dataset — tidak ada lagi form scrape
 * yang tersembunyi di balik `<details>`.
 */
const DataSourcePanel = (props: Props) => {
  const {
    defaultTab = 'upload',
    showUploadTab,
    uploadSlot,
    srcProvider,
    setSrcProvider,
    presets,
    scrapeUrl,
    setScrapeUrl,
    advanced,
    setAdvanced,
    inspect,
    pickTable,
    setPickTable,
    srcConfig,
    setSrcConfig,
    sources,
    fetchSource,
    inspectTables,
    setMsg,
    setErr
  } = props

  const isBrowser = BROWSER_PROVIDERS.includes(srcProvider)

  function pickProvider(pv: string) {
    setSrcProvider(pv)

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

  /** Tulis satu kunci ke JSON config (dipakai tab Sosmed agar tanpa edit JSON). */
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
        setMsg('Login sosmed dimuat (storage_state.json) — siap scrape.')
      } catch (e: unknown) {
        setErr('File storage_state.json tidak valid: ' + (e instanceof Error ? e.message : ''))
      }
    }

    reader.readAsText(f)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='font-semibold tracking-[-0.02em]'>Sumber Data</CardTitle>
        <CardDescription>
          Tiga pintu masuk, satu hasil: dataset berversi yang siap dianalisis. Pilih salah satu.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={showUploadTab ? defaultTab : defaultTab === 'upload' ? 'sosmed' : defaultTab}>
          <TabsList className='grid w-full grid-cols-3'>
            {showUploadTab && (
              <TabsTrigger value='upload' className='gap-1.5'>
                <UploadIcon className='size-3.5' />
                Unggah File
              </TabsTrigger>
            )}
            <TabsTrigger value='sosmed' className='gap-1.5'>
              <Share2Icon className='size-3.5' />
              Sosmed
            </TabsTrigger>
            <TabsTrigger value='web' className='gap-1.5'>
              <GlobeIcon className='size-3.5' />
              Web / API
            </TabsTrigger>
          </TabsList>

          {showUploadTab && <TabsContent value='upload' className='pt-4'>{uploadSlot}</TabsContent>}

          <TabsContent value='sosmed' className='pt-4'>
            <form onSubmit={fetchSource} className='space-y-3'>
              <div className='grid grid-cols-2 gap-2 sm:grid-cols-5'>
                {SOSMED_META.map(s => {
                  const active = srcProvider === s.id

                  return (
                    <button
                      key={s.id}
                      type='button'
                      onClick={() => pickProvider(s.id)}
                      aria-pressed={active}
                      className={`rounded-lg border px-2 py-2.5 text-center transition ${
                        active
                          ? 'border-primary bg-primary/10 font-semibold'
                          : 'hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <span className='block text-xs'>{s.label}</span>
                      <span className='text-muted-foreground mt-0.5 block text-[10px] leading-tight'>
                        {s.hint}
                      </span>
                    </button>
                  )
                })}
              </div>

              {!isBrowser ? (
                <p className='text-muted-foreground text-xs leading-relaxed'>
                  Pilih salah satu platform di atas untuk mulai — tanpa edit JSON.
                </p>
              ) : (
                <>
                  <Field className='gap-2'>
                    <FieldLabel htmlFor='sosmed-url'>
                      Link {SOSMED_META.find(s => s.id === srcProvider)?.label}
                    </FieldLabel>
                    <Input
                      id='sosmed-url'
                      className='rounded-lg'
                      inputMode='url'
                      placeholder={SOSMED_META.find(s => s.id === srcProvider)?.placeholder}
                      value={cfgGet(srcConfig, 'url')}
                      onChange={e => patchCfg({ url: e.target.value })}
                    />
                  </Field>
                  <div className='grid gap-3 sm:grid-cols-2'>
                    <Field className='gap-2'>
                      <FieldLabel htmlFor='sosmed-limit'>Jumlah (limit)</FieldLabel>
                      <Input
                        id='sosmed-limit'
                        className='rounded-lg'
                        inputMode='numeric'
                        value={cfgGet(srcConfig, 'limit') || '100'}
                        onChange={e => {
                          const n = Number(e.target.value)

                          patchCfg({ limit: Number.isFinite(n) && n > 0 ? Math.floor(n) : 100 })
                        }}
                      />
                    </Field>
                    <Field className='gap-2'>
                      <FieldLabel htmlFor='sosmed-login'>Login sosmed (opsional)</FieldLabel>
                      <Input
                        id='sosmed-login'
                        type='file'
                        accept='.json,application/json'
                        className='rounded-lg text-xs'
                        onChange={e => onStorageFile(e.target.files?.[0])}
                      />
                    </Field>
                  </div>
                  <p className='text-muted-foreground text-xs leading-relaxed'>
                    Tanpa file login, konten publik tetap bisa diambil. Untuk akun/konten privat:
                    login sekali di browser, export <code className='font-mono'>storage_state.json</code>,
                    lalu unggah di sini.
                    {cfgGet(srcConfig, 'storage_state') && (
                      <span className='text-primary font-medium'> ✓ login terpasang</span>
                    )}
                  </p>
                  <Button type='submit'>
                    Ambil Data → jadi dataset
                  </Button>
                </>
              )}
            </form>
          </TabsContent>

          <TabsContent value='web' className='pt-4'>
            <form onSubmit={fetchSource} className='space-y-2'>
              <Select value={srcProvider} onValueChange={v => pickProvider(v ?? 'generic_rest')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='generic_rest'>API generik (REST JSON)</SelectItem>
                  <SelectItem value='youtube'>YouTube Data API (OAuth/API key)</SelectItem>
                  <SelectItem value='html_table'>Scraper tabel HTML (allowlist)</SelectItem>
                </SelectContent>
              </Select>
              {(srcProvider === 'html_table' && !advanced) ? (
                <>
                  <select
                    aria-label='Preset'
                    className='border-input w-full rounded-lg border px-3 py-2 text-sm'
                    value=''
                    onChange={e => {
                      const pr = presets.find(x => x.id === e.target.value)

                      if (pr) setScrapeUrl(pr.example_url)
                    }}
                  >
                    <option value=''>— Pilih preset (opsional) —</option>
                    {presets.map(pr => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name} — {pr.description}
                      </option>
                    ))}
                  </select>
                  <div className='flex gap-2'>
                    <Input
                      placeholder='https://domain-allowlisted/halaman'
                      className='rounded-lg'
                      value={scrapeUrl}
                      onChange={e => setScrapeUrl(e.target.value)}
                      aria-label='URL halaman'
                    />
                    <Button type='button' variant='secondary' onClick={() => void inspectTables()}>
                      Cek tabel
                    </Button>
                  </div>
                  {inspect && (
                    <div className='space-y-2'>
                      {inspect.tables.map(t => (
                        <label
                          key={t.index}
                          className='flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm'
                        >
                          <input
                            type='radio'
                            name='picktable'
                            checked={pickTable === t.index}
                            onChange={() => setPickTable(t.index)}
                            className='mt-1'
                          />
                          <span>
                            <strong>Tabel {t.index}</strong> — {t.rows}×{t.cols} ·{' '}
                            {t.columns.slice(0, 6).join(', ')}
                            {t.sample[0] && (
                              <span className='text-muted-foreground block font-mono text-[11px]'>
                                {JSON.stringify(t.sample[0]).slice(0, 120)}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                      {inspect.tables.length === 0 && (
                        <p className='text-muted-foreground text-xs'>Tidak ada tabel di halaman ini.</p>
                      )}
                    </div>
                  )}
                  <div className='flex items-center gap-2'>
                    <Button type='submit'>Fetch → dataset versioned</Button>
                    <button
                      type='button'
                      className='text-xs font-medium text-primary hover:underline'
                      onClick={() => setAdvanced(true)}
                    >
                      Mode advanced (JSON)
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Textarea rows={8} className='rounded-lg font-mono text-xs' value={srcConfig} onChange={e => setSrcConfig(e.target.value)} placeholder={'{"url":"https://...","limit":100}'} />
                  <div className='flex items-center gap-2'>
                    <Button type='submit'>Fetch → dataset versioned</Button>
                    {srcProvider === 'html_table' && (
                      <button
                        type='button'
                        className='text-xs font-medium text-primary hover:underline'
                        onClick={() => setAdvanced(false)}
                      >
                        Kembali ke wizard
                      </button>
                    )}
                  </div>
                </>
              )}
            </form>
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
                      <TableCell>
                        {x.kind}:{x.provider}
                      </TableCell>
                      <TableCell>{x.record_count ?? '-'}</TableCell>
                      <TableCell className='text-muted-foreground font-mono text-[11px]'>
                        {x.dataset_id?.slice(0, 8) || '-'}
                      </TableCell>
                      <TableCell className='text-muted-foreground font-mono text-[11px]'>{x.created_at}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export default DataSourcePanel
