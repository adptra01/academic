'use client'

// React Imports
import { useEffect, useState } from 'react'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { ArrowRightIcon, FolderOpenIcon, Trash2Icon } from 'lucide-react'

// Component Imports
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

// Util Imports
import { api, apiUrl, authHeaders } from '@/lib/api'

type Project = {
  id: string
  title: string
  description: string | null
  research_type: string
  created_at: string
  updated_at: string
}

/** Nilai yang diizinkan backend: `^(Skripsi|Tesis|Disertasi|Paper|Lainnya)$`. */
const TYPES = ['Skripsi', 'Tesis', 'Disertasi', 'Paper', 'Lainnya'] as const

/** Tanggal ISO → "12 Okt 2026". Sengaja tanpa library date. */
function fmtDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

const DashboardView = () => {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [researchType, setResearchType] = useState<string>('Skripsi')
  const [creating, setCreating] = useState(false)
  const [titleError, setTitleError] = useState('')

  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)

  const [delTarget, setDelTarget] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    setLoading(true)
    try {
      setProjects(await api<Project[]>('/api/v1/projects'))
      setErr('')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat daftar project')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) {
      setTitleError('Judul wajib diisi.')
      return
    }
    setTitleError('')
    setCreating(true)
    setErr('')
    try {
      const created = await api<Project>('/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify({ title: t, description: description.trim() || null, research_type: researchType })
      })
      setTitle('')
      setDescription('')
      setMsg(`Project "${created.title}" dibuat.`)
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal membuat project')
    } finally {
      setCreating(false)
    }
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setMsg('')
    setPwBusy(true)
    try {
      await api('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ old_password: oldPw, new_password: newPw })
      })
      setOldPw('')
      setNewPw('')
      setMsg('Password berhasil diganti.')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal ganti password')
    } finally {
      setPwBusy(false)
    }
  }

  async function remove() {
    if (!delTarget) return
    setDeleting(true)
    setErr('')
    setMsg('')
    try {
      const res = await fetch(`${apiUrl()}/api/v1/projects/${delTarget.id}`, {
        method: 'DELETE',
        headers: authHeaders()
      })
      if (res.status !== 204) throw new Error(`HTTP ${res.status}`)
      setMsg(`Project "${delTarget.title}" dihapus.`)
      setDelTarget(null)
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Hapus gagal')
      setDelTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl leading-[1.05] font-bold tracking-[-0.03em]'>Dashboard</h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Satu penelitian = satu project. Mulai dari judul, lalu unggah data.
        </p>
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

      <div className='grid gap-6 xl:grid-cols-12'>
        <Card className='xl:col-span-7'>
          <CardHeader>
            <div className='flex items-baseline justify-between gap-4'>
              <CardTitle className='font-semibold tracking-[-0.02em]'>Buat Project Baru</CardTitle>
              <span className='text-muted-foreground font-mono text-[11px] font-medium uppercase tracking-[0.2em]'>
                Tahap 01
              </span>
            </div>
            <CardDescription>
              Satu penelitian = satu project. Dataset dan analisis tidak bercampur antar penelitian.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={create}>
              <FieldGroup className='gap-4'>
                <Field className='gap-2'>
                  <FieldLabel htmlFor='p-title'>1. Judul penelitian</FieldLabel>
                  <Input
                    id='p-title'
                    className='rounded-lg'
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder='mis. Pengaruh beban kerja terhadap produktivitas'
                    aria-invalid={!!titleError}
                  />
                  {titleError ? (
                    <p className='text-destructive text-xs'>{titleError}</p>
                  ) : (
                    <p className='text-muted-foreground text-xs'>
                      Bisa diubah nanti. Judul yang jelas memudahkan pencarian.
                    </p>
                  )}
                </Field>
                <Field className='gap-2'>
                  <FieldLabel htmlFor='p-type'>2. Jenis penelitian</FieldLabel>
                  <Select value={researchType} onValueChange={v => setResearchType(v ?? 'Skripsi')}>
                    <SelectTrigger id='p-type' aria-label='Jenis penelitian'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map(t => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field className='gap-2'>
                  <FieldLabel htmlFor='p-desc'>3. Catatan (opsional)</FieldLabel>
                  <Textarea
                    id='p-desc'
                    className='rounded-lg'
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder='opsional — hipotesis, sumber data, atau catatan metodologi'
                  />
                </Field>
                <Field orientation='horizontal' className='items-center gap-3'>
                  <Button type='submit' disabled={creating}>
                    {creating ? 'Membuat…' : 'Buat Project'}
                    <ArrowRightIcon />
                  </Button>
                  <span className='text-muted-foreground text-xs'>
                    Setelah dibuat, project bisa langsung diunggah datanya.
                  </span>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card className='xl:col-span-5'>
          <CardHeader>
            <CardTitle className='font-semibold tracking-[-0.02em]'>Setelah project dibuat, Anda akan</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className='space-y-4'>
              {[
                ['02', 'Unggah file data', 'Pilih file CSV atau Excel dari komputer. Isinya bisa Anda periksa sebelum dianalisis.'],
                ['03', 'Cek setiap kolom', 'Tentukan jenis data dan peran tiap kolom. Ini yang memilih metode mana yang boleh dipakai.'],
                ['04', 'Bersihkan data', 'Hapus baris kosong atau nilai yang terlalu jauh berbeda. File asli tetap tersimpan utuh.']
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
            <Separator className='my-4' />
            <Button variant='link' className='h-auto p-0' render={<Link href='/alur' />} nativeButton={false}>
              Lihat semua tahapan
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className='flex items-center justify-between gap-4'>
            <CardTitle className='flex items-center gap-2 font-semibold tracking-[-0.02em]'>
              <FolderOpenIcon className='size-4 text-primary' />
              Project Saya
            </CardTitle>
            <span className='text-muted-foreground font-mono text-[11px] font-medium uppercase tracking-[0.2em]'>
              {loading ? 'memuat…' : `${projects.length} project`}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ul className='divide-y' aria-busy='true'>
              {[0, 1, 2].map(i => (
                <li key={i} className='flex items-center gap-4 py-4'>
                  <div className='bg-muted h-4 w-1/2 animate-pulse rounded-sm' />
                  <div className='bg-muted ml-auto h-3 w-20 animate-pulse rounded-sm' />
                </li>
              ))}
            </ul>
          ) : projects.length === 0 ? (
            <div className='rounded-xl border border-dashed px-6 py-12 text-center'>
              <p className='mt-4 text-sm font-medium'>Belum ada project</p>
              <p className='text-muted-foreground mx-auto mt-1.5 max-w-md text-xs leading-relaxed'>
                Buat project di atas untuk mulai. Setelah itu file data bisa langsung diunggah dan
                dianalisis tanpa langkah konversi manual.
              </p>
            </div>
          ) : (
            <ul className='divide-y'>
              {projects.map(p => (
                <li key={p.id} className='group flex items-center gap-4 py-3.5'>
                  <div className='min-w-0 flex-1'>
                    <Link
                      href={`/projects/${p.id}`}
                      className='block truncate text-sm font-medium hover:text-primary hover:underline'
                    >
                      {p.title}
                    </Link>
                    <div className='mt-1 flex flex-wrap items-center gap-x-3 gap-y-1'>
                      <Badge variant='secondary'>{p.research_type}</Badge>
                      <span className='text-muted-foreground font-mono text-[11px]'>
                        diubah {fmtDate(p.updated_at)}
                      </span>
                    </div>
                  </div>
                  <Button variant='outline' size='sm' render={<Link href={`/projects/${p.id}`} />} nativeButton={false}>
                    Buka
                    <ArrowRightIcon />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label={`Hapus project ${p.title}`}
                    onClick={() => setDelTarget(p)}
                    className='text-muted-foreground hover:text-destructive'
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <details className='group'>
        <summary className='cursor-pointer list-none text-sm font-medium hover:underline'>
          Ganti password
        </summary>
        <form onSubmit={changePw} className='mt-4 max-w-lg'>
          <FieldGroup className='gap-3'>
            <Field className='gap-2'>
              <FieldLabel htmlFor='old'>Password lama</FieldLabel>
              <Input
                id='old'
                className='rounded-lg'
                type='password'
                value={oldPw}
                onChange={e => setOldPw(e.target.value)}
                autoComplete='current-password'
              />
            </Field>
            <Field className='gap-2'>
              <FieldLabel htmlFor='new'>Password baru</FieldLabel>
              <Input
                id='new'
                className='rounded-lg'
                type='password'
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                autoComplete='new-password'
              />
              <p className='text-muted-foreground text-xs'>Minimal 8 karakter.</p>
            </Field>
            <Button type='submit' variant='outline' disabled={pwBusy}>
              {pwBusy ? 'Menyimpan…' : 'Simpan Password Baru'}
            </Button>
          </FieldGroup>
        </form>
      </details>

      <Dialog open={!!delTarget} onOpenChange={o => !o && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus project?</DialogTitle>
            <DialogDescription>
              {delTarget?.title} beserta seluruh dataset, versi, dan analisis di dalamnya akan dihapus.
              Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDelTarget(null)}>
              Batal
            </Button>
            <Button variant='destructive' onClick={() => void remove()} disabled={deleting}>
              {deleting ? 'Menghapus…' : 'Hapus project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default DashboardView
