'use client'

// React Imports
import { useEffect, useState } from 'react'

// Third-party Imports
import { KeyRoundIcon, UserRoundIcon } from 'lucide-react'

// Component Imports
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

// Util Imports
import { api } from '@/lib/api'

type Me = { id: string; email: string; name: string; created_at: string }

/** Inisial avatar dari nama/email: "Budi Santoso" → "BS". */
function initialsOf(name?: string, email?: string) {
  const base = (name || email || '?').trim()
  const parts = base.split(/\s+/)

  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()

  return base.slice(0, 2).toUpperCase()
}

/** "2026-10-14T…" → "14 Oktober 2026". */
function fmtDate(iso: string) {
  const d = new Date(iso)

  if (Number.isNaN(d.getTime())) return iso

  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

const ProfileView = () => {
  const [me, setMe] = useState<Me | null>(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const [name, setName] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)

  useEffect(() => {
    api<Me>(`/api/v1/auth/me`)
      .then(u => {
        setMe(u)
        setName(u.name)
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Gagal memuat profil'))
  }, [])

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()

    if (!n) {
      setErr('Nama tidak boleh kosong.')

      return
    }

    setErr('')
    setMsg('')
    setSavingName(true)

    try {
      const u = await api<Me>(`/api/v1/auth/me`, {
        method: 'PATCH',
        body: JSON.stringify({ name: n })
      })

      setMe(u)
      setMsg('Nama berhasil diperbarui.')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal memperbarui nama')
    } finally {
      setSavingName(false)
    }
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setMsg('')

    if (newPw.length < 8) {
      setErr('Password baru minimal 8 karakter.')

      return
    }

    if (newPw !== confirmPw) {
      setErr('Konfirmasi password tidak sama.')

      return
    }

    setPwBusy(true)

    try {
      await api('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ old_password: oldPw, new_password: newPw })
      })
      setOldPw('')
      setNewPw('')
      setConfirmPw('')
      setMsg('Password berhasil diganti.')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal ganti password')
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl leading-[1.05] font-bold tracking-[-0.03em]'>Profil</h1>
        <p className='text-muted-foreground mt-1 text-sm'>Lihat dan kelola informasi akun Anda.</p>
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

      {/* Ringkasan identitas */}
      <Card>
        <CardContent className='pt-6'>
          {!me ? (
            <div className='flex items-center gap-4'>
              <Skeleton className='size-16 rounded-full' />
              <div className='flex-1 space-y-2'>
                <Skeleton className='h-5 w-48' />
                <Skeleton className='h-4 w-64' />
              </div>
            </div>
          ) : (
            <div className='flex flex-wrap items-center gap-4'>
              <Avatar className='size-16 text-lg'>
                <AvatarFallback>{initialsOf(me.name, me.email)}</AvatarFallback>
              </Avatar>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-lg font-semibold tracking-[-0.02em]'>{me.name}</p>
                <p className='text-muted-foreground truncate text-sm'>{me.email}</p>
                <p className='text-muted-foreground mt-1 font-mono text-[11px]'>
                  Terdaftar {fmtDate(me.created_at)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className='grid items-start gap-6 xl:grid-cols-2'>
        <Card>
          <CardHeader>
            <div className='flex items-center gap-2.5'>
              <span className='bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg'>
                <UserRoundIcon className='size-4.5' />
              </span>
              <div>
                <CardTitle className='font-semibold tracking-[-0.02em]'>Data diri</CardTitle>
                <CardDescription>Nama tampil di seluruh aktivitas Anda.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!me ? (
              <div className='space-y-3'>
                <Skeleton className='h-9 w-full' />
                <Skeleton className='h-9 w-full' />
                <Skeleton className='h-9 w-32' />
              </div>
            ) : (
              <form onSubmit={saveName} className='space-y-4'>
                <Field className='gap-2'>
                  <FieldLabel htmlFor='pf-name'>Nama</FieldLabel>
                  <Input
                    id='pf-name'
                    className='rounded-lg'
                    autoComplete='name'
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder='Nama lengkap Anda'
                  />
                </Field>
                <Field className='gap-2'>
                  <FieldLabel htmlFor='pf-email'>Email</FieldLabel>
                  <Input
                    id='pf-email'
                    className='rounded-lg'
                    value={me.email}
                    disabled
                    readOnly
                    aria-describedby='pf-email-hint'
                  />
                  <p id='pf-email-hint' className='text-muted-foreground text-xs'>
                    Email tidak dapat diubah. Hubungi admin bila perlu diganti.
                  </p>
                </Field>
                <Button type='submit' disabled={savingName}>
                  {savingName ? 'Menyimpan…' : 'Simpan Perubahan'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className='flex items-center gap-2.5'>
              <span className='bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg'>
                <KeyRoundIcon className='size-4.5' />
              </span>
              <div>
                <CardTitle className='font-semibold tracking-[-0.02em]'>Ganti password</CardTitle>
                <CardDescription>Hanya untuk akun email — akun Google tidak punya password.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePw} className='space-y-4'>
              <Field className='gap-2'>
                <FieldLabel htmlFor='pf-old'>Password lama</FieldLabel>
                <Input
                  id='pf-old'
                  type='password'
                  className='rounded-lg'
                  autoComplete='current-password'
                  value={oldPw}
                  onChange={e => setOldPw(e.target.value)}
                  placeholder='••••••••'
                />
              </Field>
              <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2'>
                <Field className='gap-2'>
                  <FieldLabel htmlFor='pf-new'>Password baru</FieldLabel>
                  <Input
                    id='pf-new'
                    type='password'
                    className='rounded-lg'
                    autoComplete='new-password'
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder='Min 8 karakter'
                  />
                </Field>
                <Field className='gap-2'>
                  <FieldLabel htmlFor='pf-confirm'>Ulangi password baru</FieldLabel>
                  <Input
                    id='pf-confirm'
                    type='password'
                    className='rounded-lg'
                    autoComplete='new-password'
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    placeholder='Sama seperti di samping'
                  />
                </Field>
              </div>
              <Button type='submit' disabled={pwBusy}>
                {pwBusy ? 'Menyimpan…' : 'Simpan Password Baru'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ProfileView
