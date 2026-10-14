'use client'

// React Imports
import { useEffect, useState } from 'react'

// Next Imports
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams } from 'next/navigation'

// Third-party Imports
import {
  BrainIcon,
  ChartBarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Columns3Icon,
  DatabaseIcon,
  DownloadIcon,
  FlaskConicalIcon,
  HistoryIcon,
  PlayIcon,
  SettingsIcon,
  UploadIcon
} from 'lucide-react'

// Component Imports
import StepNav, { type StepStatus } from '@/components/academic/step-nav'
import VariablePicker from '@/components/academic/variable-picker'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

// Util Imports
import { api, apiUrl, authHeaders, downloadExport, fetchWithContext } from '@/lib/api'
import { STATUS_HELP, TAB_HINT, TAB_LABEL } from '@/lib/plain-terms'
import DataSourcePanel from './DataSourcePanel'

// Wizard terpandu berat (±6 step + chart): dipisah jadi chunk sendiri agar
// halaman project ringan saat mode manual (aturan 1.5 skill).
const GuidedWizard = dynamic(
  () => import('./GuidedWizard').then(m => m.GuidedWizard),
  { ssr: false, loading: () => <p className='text-muted-foreground text-sm'>Memuat panduan…</p> }
)

// `transformation_log` sengaja ikut dibawa: tanpa itu pengguna tidak tahu apa
// yang sebenarnya terjadi pada datanya (imputasi, filter, ubah tipe) sebelum
// dianalisis — sumber paling umum kebetulan metodologis dibabkan data mentah.
type Version = {
  version_number: number
  transformation_log?: { op?: string; [k: string]: unknown }[]
}
type ProjectMeta = {
  id: string
  title: string
  description: string | null
  research_type: string
  created_at: string
  updated_at: string
}
type Dataset = { id: string; filename: string; file_type: string; rows_count: number; cols_count: number; versions: Version[] }
type AnalysisItem = { analysis_uid: string; method: string; created_at: string; dataset_version_number?: number | null; result_hash?: string | null; params?: Record<string, unknown> }
type ExportItem = { analysis_uid: string; method: string; format: string; created_at: string }
type Variable = { id: string; name: string; var_type: string; var_role: string }

// Spec bertipe dari GET /api/v1/methods/{id} (lihat VariablePicker).
type ColSpec = { kind: 'any' | 'numeric' | 'categorical' | 'group' | 'text'; label: string; multi?: boolean }

type ParamSpec = {
  kind: 'number' | 'int' | 'enum' | 'number_list'
  label: string
  required?: boolean
  default?: string | number
  options?: string[]
  min?: number
  max?: number
  hint?: string
}
type Profile = { rows: number; cols: number; missing_pct: number; duplicate_rows: number; columns: { name: string; detected_type: string; missing_count: number; unique_count: number }[] }
type Diff = { from: number; to: number; rows_from: number; rows_to: number; rows_delta: number; columns_added: string[]; columns_removed: string[]; numeric_drift: { column: string; mean_from: number | null; mean_to: number | null; missing_from: number; missing_to: number }[] }

// Phase-2 methods (hidden by default via FEATURE_PHASE2 flag)
const PHASE2_METHODS = ['ml_classify', 'ml_cluster', 'text_tfidf', 'text_lda', 'apriori']
const ALL_METHODS = ['descriptive', 'normality', 'pearson', 'spearman', 'ttest_1samp', 'ttest_ind', 'ttest_paired', 'anova_oneway', 'chi2_independence', 'chi2_gof', 'mannwhitney', 'wilcoxon', 'kruskal', 'linreg_simple', 'linreg_multiple', ...PHASE2_METHODS]
const OPS = ['drop_missing', 'fill_missing', 'remove_outlier_iqr', 'scale_standard', 'scale_minmax', 'transform_log', 'transform_sqrt', 'mapping', 'onehot', 'rename', 'drop_columns', 'text_lowercase', 'text_remove_punct', 'text_remove_stopwords', 'remove_duplicates']
const VTYPES = ['Numerical', 'Ordinal', 'Nominal', 'Binary', 'Text', 'Datetime', 'ID']
const VROLES = ['Independent', 'Dependent', 'Control', 'Grouping', 'ID', 'Ignore']

/** Urutan tahap kerja 02–07. `diff` digabung ke tahap Bersihkan. */
const STEP_ORDER = ['dataset', 'variables', 'preprocess', 'analysis', 'log', 'exports'] as const

type StepKey = (typeof STEP_ORDER)[number]

const STEP_NUMBER: Record<StepKey, string> = {
  dataset: '02',
  variables: '03',
  preprocess: '04',
  analysis: '05',
  log: '06',
  exports: '07'
}

const STEP_ICON = {
  dataset: DatabaseIcon,
  variables: Columns3Icon,
  preprocess: FlaskConicalIcon,
  analysis: ChartBarIcon,
  log: HistoryIcon,
  exports: DownloadIcon
} as const

const METHOD_PLAIN: Record<string, string> = {
  descriptive: 'Ringkasan data (mean, SD, median)',
  normality: 'Uji normalitas (Shapiro-Wilk, Kolmogorov-Smirnov)',
  pearson: 'Korelasi Pearson (linear)',
  spearman: 'Korelasi Spearman (berpola)',
  ttest_1samp: 'Uji t satu sampel',
  ttest_ind: 'Uji t dua kelompok independen',
  ttest_paired: 'Uji t dua pengukuran berpasangan',
  anova_oneway: 'ANOVA satu arah',
  chi2_independence: 'Uji chi-kuadrat (dua variabel kategorik)',
  chi2_gof: 'Uji chi-kuadrat (kesesuaian distribusi)',
  mannwhitney: 'Uji Mann-Whitney U (tanpa asumsi normal)',
  wilcoxon: 'Uji Wilcoxon (berpasangan, tanpa normal)',
  kruskal: 'Uji Kruskal-Wallis (tiga kelompok atau lebih)',
  linreg_simple: 'Regresi linier sederhana',
  linreg_multiple: 'Regresi linier berganda',
  ml_classify: 'Klasifikasi machine learning',
  ml_cluster: 'Clustering machine learning',
  text_tfidf: 'Vektorisasi teks TF-IDF',
  text_lda: 'Topic modeling LDA',
  apriori: 'Aturan asosiasi Apriori'
}

const OP_PLAIN: Record<string, { name: string }> = {
  drop_missing: { name: 'Hapus baris yang ada data kosongnya' },
  fill_missing: { name: 'Isi data yang kosong' },
  remove_outlier_iqr: { name: 'Buang nilai yang terlalu jauh berbeda' },
  scale_standard: { name: 'Samakan skala (standardisasi)' },
  scale_minmax: { name: 'Samakan skala ke rentang 0 sampai 1' },
  transform_log: { name: 'Ubah ke bentuk logaritma' },
  transform_sqrt: { name: 'Ubah ke akar kuadrat' },
  mapping: { name: 'Ganti nilai kategori' },
  onehot: { name: 'Pisahkan kolom kategori menjadi kolom 0 dan 1' },
  rename: { name: 'Ganti nama kolom' },
  drop_columns: { name: 'Hapus kolom yang tidak dipakai' },
  text_lowercase: { name: 'Ubah teks jadi huruf kecil' },
  text_remove_punct: { name: 'Hapus tanda baca' },
  text_remove_stopwords: { name: 'Hapus kata-kata umum' },
  remove_duplicates: { name: 'Hapus baris yang sama persis' }
}

const ProjectView = () => {
  const params = useParams()
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string)

  // Feature flag for Phase-2 methods
  const featurePhase2 = typeof window !== 'undefined' ? (process.env.VITE_FEATURE_PHASE2 === 'true') : false
  const METHODS = featurePhase2 ? ALL_METHODS : ALL_METHODS.filter(m => !PHASE2_METHODS.includes(m))

  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([])
  const [exports, setExports] = useState<ExportItem[]>([])
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [sel, setSel] = useState<string>('')
  const [ver, setVer] = useState<number>(1)
  const [preview, setPreview] = useState<{ columns: string[]; rows: Record<string, unknown>[]; total_rows: number } | null>(null)
  const [previewOff, setPreviewOff] = useState(0)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [variables, setVariables] = useState<Variable[]>([])
  const [method, setMethod] = useState('pearson')
  const [methodSpec, setMethodSpec] = useState<{ variables?: Record<string, ColSpec>; params?: Record<string, ParamSpec> } | null>(null)
  const [varsJson, setVarsJson] = useState('')

  // Pemilih kolom (UX): pilihan kolom per kunci spec + parameter metode.
  // `picked` = kolom, `pickedParams` = angka/opsi (mu, alpha, n_clusters, ...).
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [pickedParams, setPickedParams] = useState<Record<string, string>>({})

  // Pre-flight: isu validasi dari backend, ditampilkan inline di bawah field.
  type Issue = { level: 'blocking' | 'warn'; key: string; message: string; fix: string }
  const [issues, setIssues] = useState<Issue[]>([])
  const [checking, setChecking] = useState(false)

  // Spec bertipe: `multi` menentukan kolom dikirim sebagai array atau string.
  const syncPicked = (next: Record<string, string[]>) => {
    setPicked(next)

    const spec = methodSpec?.variables ?? {}
    const out: Record<string, string[] | string> = { ...next }

    for (const [k, v] of Object.entries(out)) {
      if (!spec[k]?.multi && Array.isArray(v)) out[k] = v[0] ?? ''
    }

    setVarsJson(JSON.stringify(out))
  }

  // Kirim `mu`, `alpha`, `n_clusters`, dan friends sebagai params terpisah dari
  // kolom. Nilai string dinormalisasi ke angka kecuali daftar proporsi.
  const buildParams = (): Record<string, unknown> => {
    const spec = methodSpec?.params ?? {}
    const out: Record<string, unknown> = {}

    for (const [k, raw] of Object.entries(pickedParams)) {
      const ps = spec[k]

      if (!ps) continue

      if (ps.kind === 'number_list') {
        out[k] = raw.split(/[,\s]+/).filter(Boolean).map(Number)
      } else if (ps.kind === 'number' || ps.kind === 'int') {
        const n = Number(raw)

        if (Number.isFinite(n)) out[k] = n
      } else {
        out[k] = raw
      }
    }

    return out
  }

  const [op, setOp] = useState('scale_standard')
  const [opCol, setOpCol] = useState('')
  const [opParams, setOpParams] = useState('{}')
  const [chain, setChain] = useState<Record<string, unknown>[]>([])
  const [diffFrom, setDiffFrom] = useState('1')
  const [diffTo, setDiffTo] = useState('2')
  const [diff, setDiff] = useState<Diff | null>(null)
  const [delTarget, setDelTarget] = useState<Dataset | null>(null)
  const [sources, setSources] = useState<{ id: string; kind: string; provider: string; record_count: number | null; dataset_id: string | null; created_at: string }[]>([])
  const [srcProvider, setSrcProvider] = useState('generic_rest')
  const [presets, setPresets] = useState<{ id: string; name: string; description: string; example_url: string; table_index: number }[]>([])
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [inspect, setInspect] = useState<{ final_url: string; tables: { index: number; rows: number; cols: number; columns: string[]; sample: Record<string, unknown>[] }[] } | null>(null)
  const [pickTable, setPickTable] = useState(0)
  const [srcConfig, setSrcConfig] = useState('{\n  "url": "https://.../records",\n  "params": {"limit": 100},\n  "records_path": "data.items",\n  "mapping": {"kolom_tujuan": "path.sumber"}\n}')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [meta, setMeta] = useState<ProjectMeta | null>(null)
  const [tab, setTab] = useState<string>('dataset')
  
  // Mode persistence — init statis agar SSR dan render pertama client identik,
  // nilai localStorage dibaca di effect (aturan 8.3: no localStorage di render).
  const [mode, setMode] = useState<'guided' | 'manual'>('guided')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`project_mode_${id}`)

      if (saved === 'guided' || saved === 'manual') {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Sinkronisasi preferensi tersimpan sekali setelah mount; init statis agar SSR identik.
        setMode(saved)
      }
    } catch {
      /* abaikan — tetap guided */
    }
  }, [id])
  // Config passed from Guided mode to Manual mode
  const [guidedConfig, setGuidedConfig] = useState<{ method: string; variables: Record<string, unknown>; params: Record<string, unknown> } | null>(null)
  const [loading, setLoading] = useState(true)

  // Persist mode preference
  useEffect(() => {
    if (id) localStorage.setItem(`project_mode_${id}`, mode)
  }, [mode, id])

  // Apply guided config to manual tabs when switching
  useEffect(() => {
    if (guidedConfig && mode === 'manual') {
      setMethod(guidedConfig.method)
      setPicked(guidedConfig.variables as Record<string, string[]>)
      setPickedParams(guidedConfig.params as Record<string, string>)
      setGuidedConfig(null) // Clear after applying
    }
  }, [guidedConfig, mode])

  async function load() {
    try {
      // Lima fetch independen dijalankan konkuren — bukan waterfall
      // (aturan 3.1 skill): TTFB = yang terlambat, bukan jumlah semuanya.
      // `allSettled`: satu endpoint 500 tidak menghanguskan seluruh halaman —
      // bagian yang gagal tampil kosong + pesan, sisanya tetap bisa dipakai.
      const [ds, an, ex, src, m] = await Promise.all([
        api<Dataset[]>(`/api/v1/projects/${id}/datasets`).catch(() => [] as Dataset[]),
        api<AnalysisItem[]>(`/api/v1/projects/${id}/analyses`).catch(() => [] as AnalysisItem[]),
        api<ExportItem[]>(`/api/v1/projects/${id}/exports`).catch(() => [] as ExportItem[]),
        api<{ id: string; kind: string; provider: string; record_count: number | null; dataset_id: string | null; created_at: string }[]>(`/api/v1/projects/${id}/data-sources`).catch(() => []),
        api<ProjectMeta>(`/api/v1/projects/${id}`)
      ])

      setDatasets(ds)
      if (!sel && ds[0]) setSel(ds[0].id)
      setAnalyses(an)
      setExports(ex)
      setSources(src)
      setMeta(m)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Baca/fetch sistem eksternal (localStorage/API/CSS var) saat mount atau saat dependensi berubah; lazy state di render akan menyebabkan hydration mismatch.
    if (id) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadDetail(dsid: string, v: number, off = previewOff) {
    try {
      setPreview(await api(`/api/v1/datasets/${dsid}/preview?version=${v}&limit=10&offset=${off}`))
      setProfile(await api<Profile>(`/api/v1/datasets/${dsid}/profile?version=${v}`))
      setVariables(await api<Variable[]>(`/api/v1/datasets/${dsid}/versions/${v}/variables`))
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal detail')
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Baca/fetch sistem eksternal (localStorage/API/CSS var) saat mount atau saat dependensi berubah; lazy state di render akan menyebabkan hydration mismatch.
    if (sel) void loadDetail(sel, ver)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, ver])
  useEffect(() => {
    api<typeof presets>(`/api/v1/scraper/presets`).then(setPresets).catch(() => setPresets([]))
     
  }, [])
  useEffect(() => {
    api<{ variables?: Record<string, ColSpec>; params?: Record<string, ParamSpec> }>(`/api/v1/methods/${method}`).then(setMethodSpec).catch(() => setMethodSpec(null))
  }, [method])

  // Pre-flight: cek backend setiap kali metode/versi/kolom/parameter berubah.
  // Debounce ringan supaya tidak memanggil API pada tiap ketikan.
  const activeDatasetId = sel || datasets[0]?.id

  useEffect(() => {
    if (tab !== 'analysis') return

    if (!activeDatasetId) return
    let cancelled = false

    const t = setTimeout(() => {
      setChecking(true)
      api<{ ok: boolean; issues: Issue[] }>(`/api/v1/analyses/preflight`, {
        method: 'POST',
        body: JSON.stringify({ project_id: id, dataset_id: activeDatasetId, base_version: ver, method, variables: JSON.parse(varsJson || '{}'), params: buildParams() })
      }).then(r => { if (!cancelled) setIssues(r.issues ?? []) })
        .catch(() => { if (!cancelled) setIssues([]) })
        .finally(() => { if (!cancelled) setChecking(false) })
    }, 350)

    return () => { cancelled = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildParams diturunkan dari pickedParams & methodSpec (keduanya ada di deps)
  }, [method, ver, varsJson, pickedParams, activeDatasetId, tab, id])

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    setErr('')
    setMsg('')
    setUploadPct(0)

    try {
      const token = window.localStorage.getItem('token')

      const done = await new Promise<{ rows: number; cols: number }>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.open('POST', `${apiUrl()}/api/v1/projects/${id}/datasets/upload`)
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

        xhr.upload.onprogress = ev => {
          if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100))
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const j = JSON.parse(xhr.responseText)

              resolve(j.profile)
            } catch {
              reject(new Error('Respons tidak valid'))
            }
          } else {
            try {
              const j = JSON.parse(xhr.responseText)

              reject(new Error(j.detail || `HTTP ${xhr.status}`))
            } catch {
              reject(new Error(`HTTP ${xhr.status}`))
            }
          }
        }

        xhr.onerror = () =>
          reject(
            new Error(
              `Tidak bisa menghubungi API di ${apiUrl()}. Pastikan backend jalan ` +
                `(ddev start) dan NEXT_PUBLIC_API_URL benar — untuk DDEV host-side ` +
                `biasanya http://localhost:8100.`
            )
          )
        xhr.send(fd)
      })

      setMsg(`Upload OK: ${done.rows} rows × ${done.cols} cols`)
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Upload gagal')
    } finally {
      setUploadPct(null)
    }
  }

  async function saveVar(v: Variable, patch: Partial<Variable>) {
    try {
      await api(`/api/v1/variables/${v.id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      setVariables(vs => vs.map(x => (x.id === v.id ? { ...x, ...patch } : x)))
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Update variabel gagal')
    }
  }

  function addOp(e: React.FormEvent) {
    e.preventDefault()
    setErr('')

    try {
      const extra = opParams.trim() ? JSON.parse(opParams) : {}

      setChain(c => [...c, { op, ...(opCol ? { column: opCol } : {}), ...extra }])
      setOpCol('')
      setOpParams('{}')
    } catch {
      setErr('Params JSON tidak valid')
    }
  }

  async function runPreprocess(e: React.FormEvent) {
    e.preventDefault()

    if (chain.length === 0) {
      setErr('Tambahkan minimal 1 operasi dulu')

      return
    }

    setErr('')
    setMsg('')

    try {
      const ops = chain

      const j = await api<{ new_version?: number; job_id?: string }>(`/api/v1/datasets/${sel}/preprocess`, {
        method: 'POST',
        body: JSON.stringify({ base_version: ver, operations: ops })
      })

      if (j.job_id) {
        setMsg(`Masuk antrean async, menunggu worker...`)

        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 2000))
          const st = await api<{ state: string; result?: { new_version: number }; error?: string }>(`/api/v1/jobs/${j.job_id}`)

          if (st.state === 'SUCCESS') {
            setMsg(`Version baru v${st.result?.new_version} dibuat (async, ${ops.length} ops)`)
            break
          }

          if (st.state === 'FAILURE') throw new Error(st.error || 'Job gagal')
          setMsg(`Worker: ${st.state}...`)
        }
      } else setMsg(`Version baru v${j.new_version} dibuat (${ops.length} ops)`)
      setChain([])
      await load()
      const vs = await api<{ versions: { version_number: number }[] }>(`/api/v1/datasets/${sel}`)

      setVer(Math.max(...vs.versions.map(v => v.version_number)))
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Preprocess gagal')
    }
  }

  function downloadLogCsv() {
    const rows = [
      ['analysis_uid', 'method', 'version', 'hash', 'created_at'],
      ...analyses.map(a => [a.analysis_uid, a.method, `v${a.dataset_version_number ?? '-'}`, a.result_hash || '', a.created_at])
    ]

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const el = document.createElement('a')

    el.href = url
    el.download = 'research_log.csv'
    el.click()
    URL.revokeObjectURL(url)
  }

  async function showDiff(e: React.FormEvent) {
    e.preventDefault()
    setErr('')

    try {
      setDiff(await api<Diff>(`/api/v1/datasets/${sel}/diff?from=${diffFrom}&to=${diffTo}`))
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Diff gagal')
    }
  }

  async function runAnalysis(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setMsg('')

    // Cegah terkirimnya JSON placeholder/kontoh milik metode lain.
    let variables: Record<string, unknown>

    try {
      variables = JSON.parse(varsJson || '{}')
    } catch {
      setErr('Format kolom tidak valid. Periksa bagian "Advanced: edit JSON manual".')

      return
    }

    const t0 = performance.now()

    try {
      const j = await api<{ analysis_uid: string }>(`/api/v1/analyses/run`, {
        method: 'POST',
        body: JSON.stringify({
          project_id: id,
          dataset_id: sel || datasets[0]?.id,
          base_version: ver,
          method,
          variables,
          params: buildParams()
        })
      })

      setMsg(`Analysis ${j.analysis_uid} selesai dalam ${((performance.now() - t0) / 1000).toFixed(1)}s`)
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Run gagal')
    }
  }

  async function inspectTables() {
    setErr('')
    setMsg('')
    setInspect(null)

    try {
      setInspect(await api(`/api/v1/scraper/inspect`, { method: 'POST', body: JSON.stringify({ url: scrapeUrl || undefined }) }))
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Inspect gagal')
    }
  }

  async function fetchSource(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setMsg('')

    try {
      let config: any
      if (srcProvider === 'html_table' && !advanced) {
        config = { url: scrapeUrl, table_index: pickTable }
      } else {
        try {
          config = JSON.parse(srcConfig)
        } catch (e) {
          throw new Error('Config JSON tidak valid')
        }
        // For browser-based scrapers, allow storage_state as string or object
        if (typeof config.storage_state === 'string') {
          try {
            config.storage_state = JSON.parse(config.storage_state)
          } catch {
            // keep as-is if not JSON
          }
        }
      }

      let kind = 'api'
      if (srcProvider === 'html_table' || srcProvider === 'tiktok_comments' || srcProvider === 'instagram_comments' || srcProvider === 'youtube_comments' || srcProvider === 'facebook_comments' || srcProvider === 'x_comments') {
        kind = 'scraper'
      } else {
        kind = 'api'
      }

      const j = await api<{ dataset_id: string; profile: { rows: number; cols: number } }>(`/api/v1/projects/${id}/data-sources/fetch`, {
        method: 'POST',
        body: JSON.stringify({ kind, provider: srcProvider, config })
      })

      setMsg(`Import OK: ${j.profile.rows} rows → dataset ${j.dataset_id.slice(0, 8)} (provenance tersimpan)`)
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Fetch gagal')
    }
  }

  async function removeDataset() {
    if (!delTarget) return
    setErr('')
    setMsg('')

    try {
      const res = await fetchWithContext(`${apiUrl()}/api/v1/datasets/${delTarget.id}`, { method: 'DELETE', headers: { ...authHeaders() } })

      if (res.status !== 204) {
        const j = await res.json().catch(() => ({}))

        throw new Error((j as { detail?: string }).detail || `HTTP ${res.status}`)
      }

      setMsg(`Dataset ${delTarget.filename} dihapus`)

      if (sel === delTarget.id) {
        setSel('')
        setPreview(null)
        setProfile(null)
        setVariables([])
      }

      setDelTarget(null)
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Hapus gagal')
      setDelTarget(null)
    }
  }

  async function downloadVersion() {
    try {
      const res = await fetchWithContext(`${apiUrl()}/api/v1/datasets/${sel}/download?version=${ver}`, { headers: { ...authHeaders() } })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')

      a.href = url
      a.download = `dataset_v${ver}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Unduh gagal')
    }
  }

  const selDs = datasets.find(d => d.id === sel)

  /* ---- Status tahap untuk StepNav ----
     PENTING: `done` hanya untuk pekerjaan yang benar-benar dilakukan pengguna.
     Dua keadaan lama ini berbohong dan sudah dibetulkan:
       - `variables` selalu 'done' begitu ada kolom, padahal tipe kolom diisi
         otomatis oleh deteksi pada saat unggah. Sekarang 'auto'.
       - `preprocess` hanya 'done' bila ada >1 versi, sehingga data yang memang
         sudah bersih tampak "belum". Sekarang 'skip' — memang tidak perlu. */
  const hasDatasets = datasets.length > 0
  const versionCount = selDs?.versions.length ?? 0

  // Berapa variabel yang tipenya diganti manual dari hasil deteksi otomatis?
  const reviewedVars = variables.filter(v => {
    const detected = profile?.columns.find(c => c.name === v.name)?.detected_type

    return detected != null && v.var_type !== detected
  }).length

  const doneSignal: Record<StepKey, boolean> = {
    dataset: hasDatasets,
    variables: reviewedVars > 0,
    preprocess: versionCount > 1,
    analysis: analyses.length > 0,
    log: analyses.length > 0,
    exports: exports.length > 0
  }

  // Keadaan "ada isinya, tapi bukan hasil kerja pengguna".
  const autoSignal: Record<StepKey, boolean> = {
    dataset: false,
    variables: variables.length > 0 && reviewedVars === 0,
    preprocess: false,
    analysis: false,
    log: false,
    exports: false
  }

  // Keadaan "memang tidak perlu dikerjakan".
  const skipSignal: Record<StepKey, boolean> = {
    dataset: false,
    variables: false,
    preprocess: versionCount === 1,
    analysis: false,
    log: false,
    exports: false
  }

  const stepSummary: Record<StepKey, string | undefined> = {
    dataset: hasDatasets ? `${datasets.length} file` : undefined,
    variables: variables.length > 0 ? `${variables.length} kolom` : undefined,
    preprocess: versionCount > 1 ? `v${ver} aktif` : versionCount === 1 ? 'data mentah' : undefined,
    analysis: analyses.length > 0 ? `${analyses.length} jalan` : undefined,
    log: analyses.length > 0 ? `${analyses.length} tercatat` : undefined,
    exports: exports.length > 0 ? `${exports.length} file` : undefined
  }

  function stepStatus(key: StepKey): StepStatus {
    if (!hasDatasets && key !== 'dataset') return 'locked'
    if (tab === key) return 'current'
    if (doneSignal[key]) return 'done'
    if (autoSignal[key]) return 'auto'
    if (skipSignal[key]) return 'skip'

    return 'todo'
  }

  function gotoStep(key: string) {
    if (!hasDatasets && key !== 'dataset') return
    setTab(key)
    document.getElementById('langkah-kerja')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const stepIndex = Math.max(0, STEP_ORDER.indexOf(tab as StepKey))
  const prevStep = stepIndex > 0 ? STEP_ORDER[stepIndex - 1] : null
  const nextStep = stepIndex < STEP_ORDER.length - 1 ? STEP_ORDER[stepIndex + 1] : null

  return (
    <div className='space-y-5'>
      <div className='flex flex-wrap items-start justify-between gap-x-8 gap-y-3'>
        <div className='min-w-0 flex-1'>
          <Button variant='link' className='h-auto p-0 text-xs' render={<Link href='/dashboard' />} nativeButton={false}>
            <ChevronLeftIcon />
            Dashboard
          </Button>
          {loading ? (
            <div className='mt-2 space-y-2.5' aria-busy='true' aria-label='Memuat project'>
              <Skeleton className='h-9 w-2/3 max-w-md' />
              <Skeleton className='h-3.5 w-64' />
              <Skeleton className='h-3.5 w-48' />
            </div>
          ) : (
            <>
              <h1 className='mt-2 truncate text-3xl leading-[1.05] font-bold tracking-[-0.03em]'>
                {meta?.title ?? 'Project'}
              </h1>
              <div className='mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5'>
                {meta && <Badge variant='secondary'>{meta.research_type}</Badge>}
                <span className='text-muted-foreground font-mono text-[11px]'>
                  {`${datasets.length} dataset · ${analyses.length} analisis · ${exports.length} export`}
                </span>
              </div>
              {meta?.description && (
                <p className='text-muted-foreground mt-3 max-w-2xl text-[13px] leading-relaxed'>{meta.description}</p>
              )}
            </>
          )}
        </div>
        <div className='flex items-center gap-3'>
          <Button variant='outline' size='sm' render={<Link href='/alur' />} nativeButton={false}>
            Panduan alur
          </Button>
          <div className='flex items-center gap-1 rounded-lg border bg-muted/50 p-1'>
            <Button
              variant={mode === 'guided' ? 'default' : 'ghost'}
              size='sm'
              onClick={() => setMode('guided')}
              className='gap-1 rounded-md'
            >
              <BrainIcon className='size-3.5' />
              Otomatis Terpandu
            </Button>
            <Button
              variant={mode === 'manual' ? 'default' : 'ghost'}
              size='sm'
              onClick={() => setMode('manual')}
              className='gap-1 rounded-md'
            >
              <SettingsIcon className='size-3.5' />
              Manual
            </Button>
          </div>
        </div>
      </div>

      {err && (
        <Alert variant='destructive'>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}
      {msg && (
        <Alert>
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      )}

      {!selDs ? (
        <div className='grid gap-6 xl:grid-cols-12'>
          <div className='xl:col-span-7'>
            <DataSourcePanel
              defaultTab='upload'
              showUploadTab
              uploadSlot={
                <form onSubmit={upload} className='space-y-3'>
                  <Field className='gap-2'>
                    <FieldLabel htmlFor='ds-file'>Pilih file dari komputer</FieldLabel>
                    <Input id='ds-file' className='rounded-lg' type='file' name='file' accept='.csv,.xlsx,.xls,.sav,.json' />
                    <p className='text-muted-foreground text-xs'>
                      Format CSV, XLSX, XLS, SAV, dan JSON diterima, maksimal 50 MB. Pemisah kolom
                      dan baris judul dibaca otomatis.
                    </p>
                  </Field>
                  {uploadPct != null ? (
                    <div className='space-y-1.5'>
                      <Progress value={uploadPct} />
                      <p className='text-muted-foreground font-mono text-[11px]'>Mengunggah {uploadPct}%</p>
                    </div>
                  ) : (
                    <Button type='submit' size='lg'>
                      <UploadIcon />
                      Unggah File Data
                    </Button>
                  )}
                </form>
              }
              srcProvider={srcProvider}
              setSrcProvider={setSrcProvider}
              presets={presets}
              scrapeUrl={scrapeUrl}
              setScrapeUrl={setScrapeUrl}
              advanced={advanced}
              setAdvanced={setAdvanced}
              inspect={inspect}
              pickTable={pickTable}
              setPickTable={setPickTable}
              srcConfig={srcConfig}
              setSrcConfig={setSrcConfig}
              sources={sources}
              fetchSource={fetchSource}
              inspectTables={inspectTables}
              setMsg={setMsg}
              setErr={setErr}
            />
          </div>
          <Card className='border-dashed xl:col-span-5'>
            <CardContent className='py-10 text-center'>
              <p className='text-sm font-medium'>Belum ada file data</p>
              <p className='text-muted-foreground mx-auto mt-1.5 max-w-sm text-xs leading-relaxed'>
                Pilih salah satu sumber di samping — file, sosmed, atau web/API. Tahap berikutnya
                (cek kolom, pembersihan, analisis, hasil, unduhan) terbuka setelah ada dataset
                yang bisa dibaca.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        mode === 'guided' ? (
          <GuidedWizard
            projectId={id}
            datasetId={sel}
            datasetVersion={ver}
            onClose={() => setMode('manual')}
            onSwitchToManual={async (configId: string) => {
              try {
                const config = await api<any>(`/api/v1/analysis-config/${configId}`)
                setGuidedConfig({
                  method: config.method,
                  variables: config.variables,
                  params: config.params
                })
                setMode('manual')
                setTab('variables') // Navigate to variables tab
              } catch (e) {
                console.error('Failed to fetch guided config:', e)
                setMode('manual')
              }
            }}
          />
        ) : (
          <div id='langkah-kerja' className='grid scroll-mt-24 gap-6 lg:grid-cols-[17.5rem_minmax(0,1fr)]'>
          <div className='bg-muted/40 min-w-0 rounded-lg border p-3 lg:sticky lg:top-20 lg:self-start'>
            <p className='text-muted-foreground px-2 pt-1 pb-2 font-mono text-[11px] font-medium uppercase tracking-[0.2em]'>
              Daftar tahap
            </p>
            <StepNav
              steps={STEP_ORDER.map(k => ({
                key: k,
                n: STEP_NUMBER[k],
                label: TAB_LABEL[k],
                hint: TAB_HINT[k],
                icon: STEP_ICON[k],
                status: stepStatus(k),
                summary: stepSummary[k]
              }))}
              onSelect={gotoStep}
            />
          </div>

          <div className='min-w-0'>
            <Card>
              <CardHeader>
                <p className='text-primary font-mono text-[11px] font-medium uppercase tracking-[0.2em]'>
                  Tahap {STEP_NUMBER[tab as StepKey]} dari 06
                </p>
                <CardTitle className='mt-1 text-lg font-semibold tracking-[-0.02em]'>{TAB_LABEL[tab]}</CardTitle>
                <CardDescription>{TAB_HINT[tab]}</CardDescription>
              </CardHeader>
            </Card>

            <div className='fade-in mt-4' key={tab}>
              {tab === 'dataset' && (
                <div className='space-y-4'>
                  <Card>
                    <CardHeader>
                      <div className='flex items-baseline justify-between gap-4'>
                        <CardTitle className='flex items-center gap-2 font-semibold tracking-[-0.02em]'>
                          <DatabaseIcon className='size-4 text-primary' />
                          File Data Anda
                        </CardTitle>
                        <span className='text-muted-foreground font-mono text-[11px] font-medium uppercase tracking-[0.2em]'>
                          {datasets.length} file
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <p className='text-muted-foreground text-sm'>Memuat…</p>
                      ) : (
                        <ul className='divide-y'>
                          {datasets.map(d => {
                            const active = d.id === sel

                            return (
                              <li key={d.id} className='flex items-center gap-4 py-3'>
                                <button
                                  type='button'
                                  onClick={() => {
                                    setSel(d.id)
                                    setVer(1)
                                    setPreviewOff(0)
                                  }}
                                  aria-current={active ? 'true' : undefined}
                                  className='min-w-0 flex-1 rounded-sm text-left hover:underline'
                                >
                                  <span className='block truncate text-sm font-medium'>{d.filename}</span>
                                  <span className='text-muted-foreground mt-1 block font-mono text-[11px]'>
                                    {d.rows_count}×{d.cols_count} ·{' '}
                                    {d.versions.length > 0
                                      ? `v${d.versions.map(v => v.version_number).join(', ')}`
                                      : 'tanpa versi'}{' '}
                                    · {d.file_type.toUpperCase()} · {d.id.slice(0, 8)}
                                  </span>
                                </button>
                                {active && <Badge title={STATUS_HELP.aktif}>sedang dipakai</Badge>}
                                <Button
                                  size='sm'
                                  variant='destructive'
                                  onClick={() => setDelTarget(d)}
                                  aria-label={`Hapus dataset ${d.filename}`}
                                >
                                  Hapus
                                </Button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </CardContent>
                  </Card>

                  <DataSourcePanel
                    defaultTab='sosmed'
                    showUploadTab={false}
                    uploadSlot={null}
                    srcProvider={srcProvider}
                    setSrcProvider={setSrcProvider}
                    presets={presets}
                    scrapeUrl={scrapeUrl}
                    setScrapeUrl={setScrapeUrl}
                    advanced={advanced}
                    setAdvanced={setAdvanced}
                    inspect={inspect}
                    pickTable={pickTable}
                    setPickTable={setPickTable}
                    srcConfig={srcConfig}
                    setSrcConfig={setSrcConfig}
                    sources={sources}
                    fetchSource={fetchSource}
                    inspectTables={inspectTables}
                    setMsg={setMsg}
                    setErr={setErr}
                  />

                  <Card>
                    <CardHeader>
                      <CardTitle className='font-semibold tracking-[-0.02em]'>Isi File: {selDs.filename}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className='text-sm'>
                        <span className='text-muted-foreground'>Pilih versi: </span>
                        {selDs.versions.map(v => (
                          <Button
                            key={v.version_number}
                            size='sm'
                            variant='secondary'
                            className='mr-1'
                            onClick={() => {
                              setVer(v.version_number)
                              setPreviewOff(0)
                            }}
                          >
                            v{v.version_number}
                          </Button>
                        ))}{' '}
                        <Button size='sm' variant='secondary' onClick={() => void downloadVersion()}>
                          Unduh Data (CSV)
                        </Button>
                      </p>
                      {preview && (
                        <>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {preview.columns.map(c => (
                                  <TableHead key={c}>{c}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {preview.rows.map((r, i) => (
                                <TableRow key={i}>
                                  {preview.columns.map(c => (
                                    <TableCell key={c}>{String(r[c] ?? '')}</TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <p className='text-muted-foreground mt-1 font-mono text-[11px]'>
                            Baris {previewOff + 1}–{previewOff + preview.rows.length} dari {preview.total_rows}{' '}
                            <Button
                              size='sm'
                              variant='secondary'
                              disabled={previewOff === 0}
                              onClick={() => {
                                const n = Math.max(0, previewOff - 10)

                                setPreviewOff(n)
                                void loadDetail(sel, ver, n)
                              }}
                            >
                              Sebelumnya
                            </Button>{' '}
                            <Button
                              size='sm'
                              variant='secondary'
                              disabled={previewOff + 10 >= preview.total_rows}
                              onClick={() => {
                                const n = previewOff + 10

                                setPreviewOff(n)
                                void loadDetail(sel, ver, n)
                              }}
                            >
                              Berikutnya
                            </Button>
                          </p>
                        </>
                      )}
                      {profile && (
                        <>
                          <h3 className='mt-5 text-sm font-semibold tracking-[-0.02em]'>Gambaran Umum Data</h3>
                          <p className='text-muted-foreground font-mono text-[11px]'>
                            {profile.rows} baris · {profile.cols} kolom · {profile.missing_pct}% data kosong ·{' '}
                            {profile.duplicate_rows} baris duplikat
                          </p>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Kolom</TableHead>
                                <TableHead>Jenis Data</TableHead>
                                <TableHead>Data Kosong</TableHead>
                                <TableHead>Nilai Unik</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {profile.columns.map(c => (
                                <TableRow key={c.name}>
                                  <TableCell>{c.name}</TableCell>
                                  <TableCell>
                                    <Badge variant='outline'>{c.detected_type}</Badge>
                                  </TableCell>
                                  <TableCell>{c.missing_count}</TableCell>
                                  <TableCell>{c.unique_count}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {tab === 'variables' && (
                <Card>
                  <CardHeader>
                    <CardTitle className='font-semibold tracking-[-0.02em]'>Pengaturan Kolom (versi {ver})</CardTitle>
                    <CardDescription>
                      Klik jenis atau peran untuk mengubah — tersimpan otomatis.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama Kolom</TableHead>
                          <TableHead>Jenis Data</TableHead>
                          <TableHead>Peran</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {variables.map(v => (
                          <TableRow key={v.id}>
                            <TableCell>{v.name}</TableCell>
                            <TableCell>
                              <Select value={v.var_type} onValueChange={x => void saveVar(v, { var_type: x ?? v.var_type })}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {VTYPES.map(t => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select value={v.var_role} onValueChange={x => void saveVar(v, { var_role: x ?? v.var_role })}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {VROLES.map(t => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {tab === 'preprocess' && (
                <div className='space-y-4'>
                  <Card>
                    <CardHeader>
                      <CardTitle className='font-semibold tracking-[-0.02em]'>Langkah Pembersihan</CardTitle>
                      <CardDescription>
                        Langkah ditambahkan ke daftar di bawah, lalu dijalankan sekaligus. Setiap
                        dijalankan membuat versi baru — file asli tetap utuh.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={addOp} className='flex flex-wrap gap-2'>
                        <Select value={op} onValueChange={v => setOp(v ?? 'scale_standard')}>
                          <SelectTrigger aria-label='Jenis pembersihan' className='min-w-52 flex-1'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPS.map(o => (
                              <SelectItem key={o} value={o}>
                                <span className='flex flex-col items-start gap-0.5'>
                                  <span className='text-xs'>{OP_PLAIN[o]?.name ?? o}</span>
                                  <span className='text-muted-foreground font-mono text-[10px]'>{o}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          aria-label='Nama kolom yang akan dibersihkan'
                          placeholder='Nama kolom, mis. service_quality'
                          value={opCol}
                          onChange={e => setOpCol(e.target.value)}
                          className='min-w-44 flex-1 rounded-lg'
                        />
                        <Button type='submit' variant='secondary'>
                          Tambah Langkah
                        </Button>
                      </form>
                      <Input
                        aria-label='Pilihan tambahan'
                        className='mt-2 rounded-lg font-mono'
                        placeholder='Pilihan tambahan, mis. {"strategy":"median"}'
                        value={opParams}
                        onChange={e => setOpParams(e.target.value)}
                      />
                      {chain.length > 0 && (
                        <ol className='mt-3 space-y-1.5'>
                          {chain.map((c, i) => (
                            <li
                              key={i}
                              className='bg-muted/50 flex items-center gap-3 rounded-lg border px-3 py-2'
                            >
                              <span className='text-muted-foreground shrink-0 font-mono text-[10px]'>{i + 1}</span>
                              <span className='min-w-0 flex-1'>
                                <span className='block text-xs'>
                                  {OP_PLAIN[String(c.op)]?.name ?? String(c.op)}
                                </span>
                                <span className='text-muted-foreground block truncate font-mono text-[10px]'>
                                  {String(c.op)}
                                  {c.column ? ` · kolom ${String(c.column)}` : ''}
                                </span>
                              </span>
                              <button
                                type='button'
                                className='text-destructive shrink-0 rounded px-2 py-1 text-xs font-medium hover:bg-destructive/10'
                                onClick={() => setChain(x => x.filter((_, j) => j !== i))}
                              >
                                Hapus
                              </button>
                            </li>
                          ))}
                        </ol>
                      )}
                      <form onSubmit={runPreprocess} className='mt-3'>
                        <Button type='submit' disabled={chain.length === 0}>
                          {chain.length === 0
                            ? 'Tambahkan langkah dulu'
                            : `Jalankan Pembersihan (${chain.length} langkah)`}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  {/* Riwayat transformasi: apa yang SUDAH dilakukan pada versi ini.
                      Tanpa ini, pengguna menganalisis data tanpa tahu bahwa
                      baris sudah dihapus atau nilai sudah diisi — dan pembimbing
                      bertanya "kenapa n-nya beda dari file asli?". */}
                  <Card>
                    <CardHeader>
                      <CardTitle className='font-semibold tracking-[-0.02em]'>
                        Riwayat Transformasi — v{ver}
                      </CardTitle>
                      <CardDescription>
                        Semua operasi yang membentuk versi data ini, dari file mentah
                        sampai siap dianalisis. Ini yang menentukan angka n di hasil.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const log = selDs?.versions.find(v => v.version_number === ver)?.transformation_log ?? []

                        if (log.length === 0) {
                          return (
                            <p className='text-muted-foreground text-sm'>
                              Belum ada transformasi — ini data mentah hasil unggahan.
                            </p>
                          )
                        }

                        return (
                          <ol className='space-y-2'>
                            {log.map((entry, i) => {
                              const op = String(entry.op ?? '')

                              const detail = Object.entries(entry)
                                .filter(([k]) => k !== 'op')
                                .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                                .join(' · ')

                              return (
                                <li key={i} className='flex items-start gap-3 text-sm'>
                                  <span className='text-muted-foreground shrink-0 font-mono text-[10px]'>{i + 1}</span>
                                  <span className='min-w-0'>
                                    <span className='block text-xs font-medium'>
                                      {OP_PLAIN[op]?.name ?? op}
                                    </span>
                                    {detail && (
                                      <span className='text-muted-foreground block truncate font-mono text-[10px]'>
                                        {detail}
                                      </span>
                                    )}
                                  </span>
                                </li>
                              )
                            })}
                          </ol>
                        )
                      })()}
                    </CardContent>
                  </Card>

                  <div className='rounded-lg border border-dashed bg-muted/40 p-4'>
                    <p className='text-muted-foreground font-mono text-[11px] font-medium uppercase tracking-[0.2em]'>
                      Opsional — setelah ada 2 versi atau lebih
                    </p>
                    <Card className='mt-2'>
                      <CardHeader>
                        <CardTitle className='font-semibold tracking-[-0.02em]'>Bandingkan Dua Versi</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={showDiff} className='flex flex-wrap gap-2'>
                          <Input aria-label='Versi lama' value={diffFrom} onChange={e => setDiffFrom(e.target.value)} className='w-28 rounded-lg' />
                          <Input aria-label='Versi baru' value={diffTo} onChange={e => setDiffTo(e.target.value)} className='w-28 rounded-lg' />
                          <Button type='submit' variant='secondary'>
                            Bandingkan
                          </Button>
                        </form>
                        {diff && (
                          <div className='mt-2 text-sm'>
                            <p>
                              Baris: {diff.rows_from} → {diff.rows_to} (Δ {diff.rows_delta >= 0 ? '+' : ''}
                              {diff.rows_delta})
                            </p>
                            <p>Kolom baru: {diff.columns_added.join(', ') || 'tidak ada'}</p>
                            <p>Kolom hilang: {diff.columns_removed.join(', ') || 'tidak ada'}</p>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Kolom</TableHead>
                                  <TableHead>Rata-rata Versi Lama</TableHead>
                                  <TableHead>Rata-rata Versi Baru</TableHead>
                                  <TableHead>Data Kosong</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {diff.numeric_drift.map(d => (
                                  <TableRow key={d.column}>
                                    <TableCell>{d.column}</TableCell>
                                    <TableCell>{d.mean_from ?? '-'}</TableCell>
                                    <TableCell>{d.mean_to ?? '-'}</TableCell>
                                    <TableCell>
                                      {d.missing_from}→{d.missing_to}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {tab === 'analysis' && (
                <Card>
                  <CardHeader>
                    <CardTitle className='font-semibold tracking-[-0.02em]'>Jalankan Analisis (dari versi {ver})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={runAnalysis} className='max-w-xl space-y-5'>
                      <Field className='gap-2'>
                        <FieldLabel htmlFor='m-method'>1. Pilih metode statistik</FieldLabel>
                        <Select value={method} onValueChange={v => setMethod(v ?? 'pearson')}>
                          <SelectTrigger id='m-method'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {METHODS.map(m => (
                              <SelectItem key={m} value={m}>
                                <span className='flex flex-col items-start gap-0.5'>
                                  <span className='text-xs'>{METHOD_PLAIN[m] ?? m}</span>
                                  <span className='text-muted-foreground font-mono text-[10px]'>{m}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {methodSpec?.variables && (
                          <p className='text-muted-foreground text-xs leading-relaxed'>
                            Metode ini butuh:{' '}
                            {Object.values(methodSpec.variables)
                              .map(v => v.label)
                              .join(', ')}
                          </p>
                        )}
                      </Field>
                      <Field className='gap-2'>
                        <FieldLabel>2. Tentukan kolom & parameter</FieldLabel>
                        <VariablePicker
                          spec={{ variables: methodSpec?.variables, params: methodSpec?.params }}
                          variables={variables}
                          value={picked}
                          params={pickedParams}
                          onChange={syncPicked}
                          onParamsChange={setPickedParams}
                        />
                        <details className='mt-2'>
                          <summary className='text-muted-foreground cursor-pointer text-xs hover:text-ink'>
                            Advanced: edit JSON manual
                          </summary>
                          <Textarea
                            id='m-vars'
                            rows={4}
                            value={varsJson}
                            onChange={e => {
                              setVarsJson(e.target.value)

                              try {
                                const parsed = JSON.parse(e.target.value) as Record<string, string[]>

                                setPicked(
                                  Object.fromEntries(
                                    Object.entries(parsed).map(([k, v]) => [k, Array.isArray(v) ? v : [v]])
                                  )
                                )
                              } catch {
                                /* JSON belum valid — biarkan teks apa adanya */
                              }
                            }}
                            className='mt-2 rounded-lg font-mono'
                            aria-describedby='m-vars-help'
                          />
                          <p id='m-vars-help' className='text-muted-foreground mt-1 text-xs leading-relaxed'>
                            Tulis nama kolom persis seperti di file Anda,{' '}
                            <span className='font-mono text-foreground'>{'{kunci: "nama_kolom"}'}</span>. Contoh:{' '}
                            <span className='font-mono text-foreground'>{'{"x": "service_quality", "y": "satisfaction"}'}</span>
                          </p>
                        </details>
                      </Field>

                      {/* Pre-flight: isu validasi tampil DI BAWAH field, bukan di
                          Alert paling atas halaman. Tombol Jalankan nonaktif
                          selama masih ada isu blocking. */}
                      {(issues.length > 0 || checking) && (
                        <div
                          role='status'
                          aria-live='polite'
                          className='rounded-xl border border-rule bg-paper-2/60 p-3.5'
                        >
                          <p className='font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-4'>
                            {checking ? 'Memeriksa isian…' : 'Sebelum dijalankan'}
                          </p>
                          <ul className='mt-2 space-y-1.5'>
                            {issues.map((iss, i) => (
                              <li key={`${iss.key}-${i}`} className='flex items-start gap-2 text-[12.5px] leading-relaxed'>
                                <span
                                  aria-hidden='true'
                                  className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${
                                    iss.level === 'blocking' ? 'bg-destructive' : 'bg-warn'
                                  }`}
                                />
                                <span className='min-w-0'>
                                  <span className={iss.level === 'blocking' ? 'text-ink' : 'text-ink-2'}>
                                    {iss.message}
                                  </span>
                                  <span className='text-ink-3'> — {iss.fix}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Button type='submit' size='lg' disabled={checking || issues.some(i => i.level === 'blocking')}>
                        <PlayIcon />
                        Jalankan Analisis
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {tab === 'log' && (
                <Card>
                  <CardHeader>
                    <CardTitle className='font-semibold tracking-[-0.02em]'>Riwayat Semua Analisis ({analyses.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button variant='outline' onClick={downloadLogCsv}>
                      <DownloadIcon />
                      Unduh Riwayat (CSV)
                    </Button>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID Analisis</TableHead>
                          <TableHead>Metode</TableHead>
                          <TableHead>Ver</TableHead>
                          <TableHead>Cap Integritas</TableHead>
                          <TableHead>Waktu</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analyses.map(a => (
                          <TableRow key={a.analysis_uid}>
                            <TableCell>
                              <Link
                                className='text-primary hover:underline'
                                href={`/analyses/${a.analysis_uid}`}
                              >
                                {a.analysis_uid}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Badge variant='secondary'>{METHOD_PLAIN[a.method] ?? a.method}</Badge>
                            </TableCell>
                            <TableCell>v{a.dataset_version_number ?? '-'}</TableCell>
                            <TableCell className='text-muted-foreground font-mono text-[11px]'>
                              {a.result_hash || '-'}
                            </TableCell>
                            <TableCell className='text-muted-foreground font-mono text-[11px]'>{a.created_at}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {tab === 'exports' && (
                <Card>
                  <CardHeader>
                    <CardTitle className='font-semibold tracking-[-0.02em]'>File yang Sudah Diunduh ({exports.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {exports.length === 0 ? (
                      <p className='text-muted-foreground text-sm leading-relaxed'>
                        Belum ada file yang diunduh. Untuk membuat file, buka salah satu analisis di tab
                        Riwayat Analisis, lalu pilih format unduhan di halaman hasil.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Analysis</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Format</TableHead>
                            <TableHead>Waktu</TableHead>
                            <TableHead>Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {exports.map((x, i) => (
                            <TableRow key={i}>
                              <TableCell className='text-xs'>
                                <Link className='text-primary hover:underline' href={`/analyses/${x.analysis_uid}`}>
                                  {x.analysis_uid}
                                </Link>
                              </TableCell>
                              <TableCell>{x.method}</TableCell>
                              <TableCell>
                                <Badge variant='outline'>{x.format.toUpperCase()}</Badge>
                              </TableCell>
                              <TableCell className='text-muted-foreground font-mono text-[11px]'>{x.created_at}</TableCell>
                              <TableCell>
                                <Button
                                  size='sm'
                                  variant='secondary'
                                  onClick={() => void downloadExport(x.analysis_uid, x.format)}
                                >
                                  Unduh
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className='mt-5 flex flex-wrap items-center justify-between gap-3'>
                {prevStep ? (
                  <Button variant='outline' onClick={() => gotoStep(prevStep)}>
                    <ChevronLeftIcon />
                    Kembali: {TAB_LABEL[prevStep]}
                  </Button>
                ) : (
                  <span />
                )}
                {nextStep ? (
                  <Button onClick={() => gotoStep(nextStep)}>
                    Lanjut: {TAB_LABEL[nextStep]}
                    <ChevronRightIcon />
                  </Button>
                ) : (
                  <span className='text-muted-foreground text-xs'>Semua tahap selesai — unduhan tersimpan di atas.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) )}

      <Dialog open={!!delTarget} onOpenChange={o => !o && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus dataset?</DialogTitle>
            <DialogDescription>
              {delTarget?.filename} beserta semua versinya akan dihapus. Ditolak server jika sudah ada
              analysis.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDelTarget(null)}>
              Batal
            </Button>
            <Button variant='destructive' onClick={() => void removeDataset()}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ProjectView
