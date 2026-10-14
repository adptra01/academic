'use client'

// React Imports
import { useEffect, useState } from 'react'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { ArrowRightIcon, ChartBarIcon, DatabaseIcon, DownloadIcon, FolderOpenIcon } from 'lucide-react'

// Component Imports
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Util Imports
import { api } from '@/lib/api'

type Project = {
  id: string
  title: string
  description: string | null
  research_type: string
  created_at: string
  updated_at: string
}

type Stat = { label: string; value: number | string; hint: string; icon: typeof FolderOpenIcon }

/** Tanggal ISO → "12 Okt 2026". Sengaja tanpa library date. */
function fmtDate(iso: string) {
  const d = new Date(iso)

  if (Number.isNaN(d.getTime())) return iso

  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

const DashboardView = () => {
  const [projects, setProjects] = useState<Project[]>([])
  const [datasetCount, setDatasetCount] = useState(0)
  const [analysisCount, setAnalysisCount] = useState(0)
  const [exportCount, setExportCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  async function load() {
    setLoading(true)

    try {
      const list = await api<Project[]>('/api/v1/projects')

      setProjects(list)

      let ds = 0
      let an = 0
      let ex = 0

      await Promise.all(
        list.map(async p => {
          try {
            const [d, a, e] = await Promise.all([
              api<unknown[]>(`/api/v1/projects/${p.id}/datasets`),
              api<unknown[]>(`/api/v1/projects/${p.id}/analyses`),
              api<unknown[]>(`/api/v1/projects/${p.id}/exports`)
            ])

            ds += d.length
            an += a.length
            ex += e.length
          } catch {
            // Satu project gagal dibaca tidak menggagalkan ringkasan.
          }
        })
      )

      setDatasetCount(ds)
      setAnalysisCount(an)
      setExportCount(ex)
      setErr('')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat ringkasan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch ringkasan sekali saat mount; state diisi dari respons API.
    void load()
  }, [])

  const stats: Stat[] = [
    { label: 'Project', value: projects.length, hint: 'penelitian', icon: FolderOpenIcon },
    { label: 'Dataset', value: datasetCount, hint: 'file data', icon: DatabaseIcon },
    { label: 'Analisis', value: analysisCount, hint: 'telah dijalankan', icon: ChartBarIcon },
    { label: 'Export', value: exportCount, hint: 'file hasil', icon: DownloadIcon }
  ]

  const recent = [...projects].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, 5)

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl leading-[1.05] font-bold tracking-[-0.03em]'>Dashboard</h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Ringkasan aktivitas penelitian Anda dalam satu pandangan.
        </p>
      </div>

      {err && (
        <Alert variant='destructive'>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className='pt-5'>
              <div className='flex items-center gap-2'>
                <s.icon className='size-4 text-primary' />
                <span className='text-muted-foreground text-xs font-medium'>{s.label}</span>
              </div>
              <p className='mt-2 text-3xl font-bold tracking-tight'>
                {loading ? '…' : s.value}
              </p>
              <p className='text-muted-foreground mt-1 text-xs'>{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className='grid gap-6 xl:grid-cols-12'>
        <Card className='xl:col-span-7'>
          <CardHeader>
            <div className='flex items-center justify-between gap-4'>
              <CardTitle className='font-semibold tracking-[-0.02em]'>Terakhir dikerjakan</CardTitle>
              <Button variant='link' className='h-auto p-0 text-xs' render={<Link href='/projek' />} nativeButton={false}>
                Kelola project
                <ArrowRightIcon />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className='text-muted-foreground text-sm'>Memuat…</p>
            ) : recent.length === 0 ? (
              <div className='rounded-xl border border-dashed px-6 py-10 text-center'>
                <p className='text-sm font-medium'>Belum ada project</p>
                <p className='text-muted-foreground mx-auto mt-1.5 max-w-md text-xs leading-relaxed'>
                  Buat project pertama Anda, lalu unggah data untuk dianalisis.
                </p>
                <Button className='mt-4' render={<Link href='/projek' />} nativeButton={false}>
                  Buat Project
                  <ArrowRightIcon />
                </Button>
              </div>
            ) : (
              <ul className='divide-y'>
                {recent.map(p => (
                  <li key={p.id} className='flex items-center gap-4 py-3'>
                    <div className='min-w-0 flex-1'>
                      <Link
                        href={`/projects/${p.id}`}
                        className='block truncate text-sm font-medium hover:text-primary hover:underline'
                      >
                        {p.title}
                      </Link>
                      <span className='text-muted-foreground mt-1 block font-mono text-[11px]'>
                        {p.research_type} · diubah {fmtDate(p.updated_at)}
                      </span>
                    </div>
                    <Button variant='outline' size='sm' render={<Link href={`/projects/${p.id}`} />} nativeButton={false}>
                      Buka
                      <ArrowRightIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className='xl:col-span-5'>
          <CardHeader>
            <CardTitle className='font-semibold tracking-[-0.02em]'>Mulai dari sini</CardTitle>
            <CardDescription>Alur kerja standar setiap penelitian.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className='space-y-4'>
              {[
                ['01', 'Buat project', 'Satu penelitian = satu project di menu Projek.'],
                ['02', 'Unggah data', 'File CSV/Excel, atau ambil dari web/API/sosial media.'],
                ['03', 'Analisis terpandu', 'Ikuti wizard Otomatis Terpandu sampai narasi hasil.'],
                ['04', 'Export', 'Unduh hasil untuk bahan laporan.']
              ].map(([n, t, d]) => (
                <li key={n} className='flex gap-3 border-t pt-3 first:border-t-0 first:pt-0'>
                  <span className='text-primary font-mono text-xs'>{n}</span>
                  <span className='min-w-0'>
                    <span className='block text-sm font-medium'>{t}</span>
                    <span className='text-muted-foreground mt-0.5 block text-xs leading-relaxed'>{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default DashboardView
