'use client'

// React Imports
import { useEffect, useState } from 'react'

// Next Imports
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

// Third-party Imports
import katex from 'katex'

// Component Imports
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

// Util Imports
import { apaStyle, api, apiUrl, authHeaders, downloadExport, fetchWithContext } from '@/lib/api'
import type { Viz } from '@/components/EChartView'

const EChartView = dynamic(() => import('@/components/EChartView'), { ssr: false })

type Detail = {
  analysis_uid: string; method: string; variables: Record<string, unknown>; params: Record<string, unknown>;
  dataset_filename?: string | null; dataset_version_number?: number | null;
  result: { method_name?: string; n?: number; statistics?: Record<string, unknown>; assumptions?: { name: string; passed?: boolean | null; p_value?: number; note?: string }[]; decision?: { text: string; p?: number; alpha?: number } | null; effect_size?: Record<string, unknown> | null; parameters?: Record<string, unknown>; formula_latex?: string; calculation?: string[]; interpretation?: string; warnings?: string[] };
  result_hash: string; software_version: string; timestamp: string;
}

const CHARTS = ['histogram', 'boxplot', 'scatter', 'bar', 'residual', 'qq', 'confusion', 'roc', 'cluster', 'dendrogram', 'topics', 'topterms', 'rules']
const FBCATS = [['statistical_result', 'Hasil statistik'], ['assumption', 'Asumsi'], ['formula', 'Formula'], ['data_processing', 'Data processing'], ['export', 'Export'], ['ui', 'UI'], ['other', 'Lainnya']]
const EXPORTS = ['csv', 'xlsx', 'pdf', 'docx', 'tex', 'json'] as const

function flatten(obj: unknown, prefix = ''): [string, string][] {
  if (obj == null) return [[prefix, '-']]
  if (typeof obj !== 'object') return [[prefix, String(obj)]]
  if (Array.isArray(obj)) return [[prefix, obj.slice(0, 10).map(String).join('; ')]]
  const rows: [string, string][] = []

  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k

    if (v != null && typeof v === 'object') rows.push(...flatten(v, key))
    else rows.push([key, String(v)])
  }

  return rows
}

function StatTable({ data }: { data: unknown }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Key</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {flatten(data).map(([k, v]) => (
          <TableRow key={k}>
            <TableCell>
              <code>{k}</code>
            </TableCell>
            <TableCell>{v}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function Formula({ latex }: { latex?: string }) {
  if (!latex) return null

  let html: string | null = null

  try {
    html = katex.renderToString(latex, { throwOnError: false, displayMode: true })
  } catch {
    html = null
  }

  // KaTeX gagal render → tampilkan sumber mentah, bukan halaman kosong.
  if (html === null) {
    return <pre className='bg-muted overflow-x-auto rounded p-3 font-mono text-xs'>{latex}</pre>
  }

  return <div className='overflow-x-auto' dangerouslySetInnerHTML={{ __html: html }} />
}

const AnalysisView = () => {
  const params = useParams()
  const uid = Array.isArray(params?.uid) ? params.uid[0] : (params?.uid as string)
  const [d, setD] = useState<Detail | null>(null)
  const [shareTok, setShareTok] = useState<string | null>(null)
  const [shareMsg, setShareMsg] = useState('')
  const [fbCat, setFbCat] = useState('statistical_result')
  const [fbDesc, setFbDesc] = useState('')
  const [fbMsg, setFbMsg] = useState('')
  const [chartType, setChartType] = useState('default')
  const [chartCol, setChartCol] = useState('all')
  const [chartUrl, setChartUrl] = useState('')
  const [vizMode, setVizMode] = useState<'png' | 'echarts'>('png')
  const [viz, setViz] = useState<Viz | null>(null)
  const [vizErr, setVizErr] = useState('')
  const [rerunMsg, setRerunMsg] = useState('')
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!uid) return
    api<Detail>(`/api/v1/analyses/${uid}`).then(setD).catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Gagal'))
    api<{ token: string }>(`/api/v1/analyses/${uid}/share`).then(s => setShareTok(s.token)).catch(() => setShareTok(null))
  }, [uid])

  useEffect(() => {
    if (!uid || vizMode !== 'png') return
    let url = ''
    const qs = new URLSearchParams()

    if (chartType && chartType !== 'default') qs.set('type', chartType)
    if (chartCol && chartCol !== 'all') qs.set('column', chartCol)
    const q = qs.toString() ? `?${qs.toString()}` : ''

    fetchWithContext(`${apiUrl()}/api/v1/analyses/${uid}/chart${q}`, { headers: { ...authHeaders() } })
      .then(res => {
        if (!res.ok) throw new Error(`Chart HTTP ${res.status}`)

        return res.blob()
      })
      .then(blob => {
        url = URL.createObjectURL(blob)
        setChartUrl(url)
      })
      .catch(() => setChartUrl(''))

    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [uid, chartType, chartCol, vizMode])

  useEffect(() => {
    if (!uid || vizMode !== 'echarts') return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Baca/fetch sistem eksternal (localStorage/API/CSS var) saat mount atau saat dependensi berubah; lazy state di render akan menyebabkan hydration mismatch.
    setVizErr('')
    const qs = new URLSearchParams()

    if (chartType && chartType !== 'default') qs.set('type', chartType)
    if (chartCol && chartCol !== 'all') qs.set('column', chartCol)
    api<Viz>(`/api/v1/analyses/${uid}/viz${qs.toString() ? `?${qs.toString()}` : ''}`)
      .then(setViz)
      .catch((e: unknown) => setVizErr(e instanceof Error ? e.message : 'Viz gagal'))
  }, [uid, chartType, chartCol, vizMode])

  async function makeShare() {
    setShareMsg('Membuat link...')

    try {
      const j = await api<{ token: string }>(`/api/v1/analyses/${uid}/share`, { method: 'POST', body: JSON.stringify({ expires_days: 30 }) })

      setShareTok(j.token)
      setShareMsg('Link aktif 30 hari. Bagikan URL di bawah.')
    } catch (e: unknown) {
      setShareMsg(e instanceof Error ? e.message : 'Gagal')
    }
  }

  async function revokeShare() {
    try {
      await api(`/api/v1/analyses/${uid}/share`, { method: 'DELETE' })
      setShareTok(null)
      setShareMsg('Link dicabut.')
    } catch (e: unknown) {
      setShareMsg(e instanceof Error ? e.message : 'Gagal')
    }
  }

  async function rerun() {
    setRerunMsg('Menjalankan ulang...')

    try {
      const j = await api<{ analysis_uid: string; result: { identical_to_original?: boolean } }>(`/api/v1/analyses/${uid}/rerun`, { method: 'POST' })

      setRerunMsg(`Rerun ${j.analysis_uid} — identik: ${j.result.identical_to_original ? 'YA ✓' : 'TIDAK (selidiki!)'}`)
    } catch (e: unknown) {
      setRerunMsg(e instanceof Error ? e.message : 'Rerun gagal')
    }
  }

  async function sendFeedback(e: React.FormEvent) {
    e.preventDefault()
    setFbMsg('')

    try {
      await api(`/api/v1/feedback`, { method: 'POST', body: JSON.stringify({ analysis_uid: uid, category: fbCat, description: fbDesc }) })
      setFbDesc('')
      setFbMsg('Laporan terkirim — terima kasih. Tim dapat mereproduksi via Analysis ID + version di atas.')
    } catch (e: unknown) {
      setFbMsg(e instanceof Error ? e.message : 'Gagal mengirim')
    }
  }

  if (err)
    return (
      <Alert variant='destructive'>
        <AlertDescription>{err}</AlertDescription>
      </Alert>
    )
  if (!d) return <p className='text-muted-foreground'>Memuat...</p>

  const r = d.result
  const reject = r.decision?.text === 'Tolak H0'

  const descCols =
    d.method === 'descriptive' && Array.isArray((d.variables as Record<string, unknown>).columns)
      ? ((d.variables as Record<string, unknown>).columns as unknown[]).map(String)
      : []

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-3xl leading-[1.05] font-bold tracking-[-0.03em]'>
          {r.method_name || d.method}{' '}
          <span className='text-muted-foreground font-mono text-sm font-normal'>{d.analysis_uid}</span>
        </h1>
        <p className='text-muted-foreground mt-1 font-mono text-xs'>
          Dataset: {d.dataset_filename || '-'} · version v{d.dataset_version_number ?? '-'} · {d.software_version} ·{' '}
          {d.timestamp}
        </p>
      </div>

      <Card>
        <CardContent>
          <p className='text-sm'>
            Keputusan: <Badge variant={reject ? 'destructive' : 'default'}>{r.decision?.text || '-'}</Badge>{' '}
            <span className='text-muted-foreground text-xs'>(α = {r.decision?.alpha ?? '-'})</span>
          </p>
          <p className='mt-2 text-sm leading-6'>{r.interpretation}</p>
          <Button
            variant='secondary'
            size='sm'
            className='mt-2'
            onClick={() => {
              void navigator.clipboard.writeText(apaStyle(r as unknown as Record<string, unknown>))
              setCopied(true)
            }}
          >
            {copied ? 'Tersalin!' : 'Copy APA-style'}
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue='hasil'>
        <TabsList>
          <TabsTrigger value='hasil'>Hasil</TabsTrigger>
          <TabsTrigger value='grafik'>Grafik</TabsTrigger>
          <TabsTrigger value='formula'>Formula</TabsTrigger>
          <TabsTrigger value='export'>Export</TabsTrigger>
          <TabsTrigger value='repro'>Repro</TabsTrigger>
          <TabsTrigger value='lapor'>Lapor</TabsTrigger>
        </TabsList>
        <TabsContent value='hasil'>
          <Card>
            <CardHeader>
              <CardTitle className='font-semibold tracking-[-0.02em]'>Tabel statistik (n = {String(r.n ?? '-')})</CardTitle>
            </CardHeader>
            <CardContent>
              <StatTable data={r.statistics} />
              {r.effect_size && (
                <>
                  <h3 className='mt-4 text-base font-semibold tracking-[-0.02em]'>Effect size</h3>
                  <StatTable data={r.effect_size} />
                </>
              )}
            </CardContent>
          </Card>
          {(r.assumptions || []).length > 0 && (
            <Card className='mt-4'>
              <CardHeader>
                <CardTitle className='font-semibold tracking-[-0.02em]'>Asumsi</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asumsi</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(r.assumptions || []).map((a, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {a.name}
                          {a.p_value != null ? ` (p=${Number(a.p_value).toFixed(4)})` : ''}
                        </TableCell>
                        <TableCell>
                          {a.passed == null ? (
                            <span className='text-muted-foreground'>cek manual</span>
                          ) : (
                            <Badge variant={a.passed ? 'default' : 'destructive'}>{a.passed ? 'PASS' : 'FAIL'}</Badge>
                          )}
                        </TableCell>
                        <TableCell className='text-muted-foreground text-xs'>{a.note || ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value='grafik'>
          <Card>
            <CardHeader>
              <CardTitle className='font-semibold tracking-[-0.02em]'>Grafik akademik</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              <div className='flex gap-2'>
                <Button size='sm' variant={vizMode === 'png' ? 'default' : 'secondary'} onClick={() => setVizMode('png')}>
                  Statis (PNG)
                </Button>
                <Button size='sm' variant={vizMode === 'echarts' ? 'default' : 'secondary'} onClick={() => setVizMode('echarts')}>
                  Interaktif
                </Button>
              </div>
              <Select value={chartType} onValueChange={v => setChartType(v ?? 'default')}>
                <SelectTrigger>
                  <SelectValue placeholder='Default' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='default'>Default</SelectItem>
                  {CHARTS.map(t => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {descCols.length > 1 && (
                <Select value={chartCol} onValueChange={v => setChartCol(v ?? 'all')}>
                  <SelectTrigger aria-label='Kolom grafik'>
                    <SelectValue placeholder='Semua (kolom pertama)' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Semua (kolom pertama)</SelectItem>
                    {descCols.map(c => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {vizMode === 'png' ? (
                <>
                  {chartUrl ? (
                     
                    <img className='chart' src={chartUrl} alt='chart' />
                  ) : (
                    <p className='text-muted-foreground text-xs'>Memuat grafik...</p>
                  )}
                </>
              ) : viz ? (
                <EChartView viz={viz} />
              ) : (
                <p className='text-muted-foreground text-xs'>{vizErr || 'Memuat grafik interaktif...'}</p>
              )}
              {chartUrl && (
                <a className='inline-block text-sm text-primary hover:underline' href={chartUrl} download={`${uid}.png`}>
                  Unduh PNG grafik
                </a>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value='formula'>
          <Card>
            <CardHeader>
              <CardTitle className='font-semibold tracking-[-0.02em]'>Formula</CardTitle>
            </CardHeader>
            <CardContent>
              <Formula latex={r.formula_latex} />
              <h3 className='mt-4 text-base font-semibold tracking-[-0.02em]'>Parameters & variables</h3>
              <pre className='bg-muted mt-2 overflow-x-auto rounded p-3 font-mono text-xs'>
                {JSON.stringify({ variables: d.variables, params: d.params }, null, 2)}
              </pre>
              <h3 className='mt-4 text-base font-semibold tracking-[-0.02em]'>Calculation</h3>
              <ol className='mt-1 list-decimal space-y-1 pl-5 text-sm'>
                {(r.calculation || []).map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ol>
              {(r.warnings || []).length > 0 && (
                <>
                  <h3 className='mt-4 text-base font-semibold tracking-[-0.02em]'>Warnings</h3>
                  <ul className='mt-1 list-disc space-y-1 pl-5 text-sm'>
                    {r.warnings!.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value='export'>
          <Card>
            <CardHeader>
              <CardTitle className='font-semibold tracking-[-0.02em]'>Export</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='flex flex-wrap gap-2'>
                {EXPORTS.map(f => (
                  <Button key={f} variant='secondary' size='sm' onClick={() => void downloadExport(uid as string, f)}>
                    Unduh {f.toUpperCase()}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value='repro'>
          <Card>
            <CardHeader>
              <CardTitle className='font-semibold tracking-[-0.02em]'>Reproducibility</CardTitle>
            </CardHeader>
            <CardContent>
              <h4 className='text-sm font-semibold tracking-[-0.02em]'>Bagikan publik</h4>
              {shareTok ? (
                <>
                  <p className='mt-1 text-sm break-all text-primary'>
                    {typeof window !== 'undefined' ? `${window.location.origin}/shared/${shareTok}` : `/shared/${shareTok}`}
                  </p>
                  <div className='mt-2 flex gap-2'>
                    <Button
                      variant='secondary'
                      size='sm'
                      onClick={() => {
                        void navigator.clipboard.writeText(`${window.location.origin}/shared/${shareTok}`)
                      }}
                    >
                      Salin link
                    </Button>
                    <Button variant='secondary' size='sm' onClick={() => void revokeShare()}>
                      Cabut
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant='secondary' size='sm' onClick={() => void makeShare()}>
                  Buat link publik (30 hari)
                </Button>
              )}
              {shareMsg && <p className='text-muted-foreground mt-2 text-sm'>{shareMsg}</p>}
              <h4 className='mt-4 text-sm font-semibold tracking-[-0.02em]'>Rerun</h4>
              <Button variant='secondary' size='sm' onClick={() => void rerun()}>
                Rerun (verifikasi identik)
              </Button>
              {rerunMsg && <p className='text-muted-foreground mt-2 text-sm'>{rerunMsg}</p>}
              <p className='text-muted-foreground mt-1 font-mono text-xs'>
                hash: {d.result_hash.slice(0, 16)}… · {d.software_version} · {d.timestamp}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value='lapor'>
          <Card>
            <CardHeader>
              <CardTitle className='font-semibold tracking-[-0.02em]'>Report a Problem</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-muted-foreground text-xs'>
                Terkirim bersama {d.analysis_uid} · dataset v{d.dataset_version_number ?? '-'} — tim dapat
                mereproduksi langsung.
              </p>
              <form onSubmit={sendFeedback} className='mt-2 space-y-2'>
                <Select value={fbCat} onValueChange={v => setFbCat(v ?? 'statistical_result')}>
                  <SelectTrigger aria-label='Kategori'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FBCATS.map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  aria-label='Deskripsi masalah'
                  className='rounded-lg'
                  rows={3}
                  placeholder='Jelaskan masalahnya (min 10 karakter)...'
                  value={fbDesc}
                  onChange={e => setFbDesc(e.target.value)}
                />
                <Button type='submit' variant='secondary' size='sm'>
                  Kirim laporan
                </Button>
              </form>
              {fbMsg && <p className='text-muted-foreground mt-2 text-sm'>{fbMsg}</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AnalysisView
