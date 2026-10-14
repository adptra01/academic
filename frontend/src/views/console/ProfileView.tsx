'use client'

// React Imports
import { useEffect, useState } from 'react'

// Component Imports
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

// Util Imports
import { api } from '@/lib/api'

type Me = { id: string; email: string; name: string; created_at: string }

const ProfileView = () => {
  const [me, setMe] = useState<Me | null>(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const [name, setName] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
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

  return (
    <div className='space-y-5'>
      <div>
        <h1 className='text-3xl leading-[1.05] font-bold tracking-[-0.03em]'>Profil</h1>
        <p className='text-muted-foreground mt-2 text-[13px] leading-relaxed'>
          Lihat dan kelola informasi akun Anda.
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

      <Card className='max-w-lg'>
        <CardHeader>
          <CardTitle className='font-semibold tracking-[-0.02em]'>Data diri</CardTitle>
          <CardDescription>Email tidak dapat diubah. Nama bisa diperbarui di bawah.</CardDescription>
        </CardHeader>
        <CardContent>
          {!me ? (
            <p className='text-muted-foreground text-sm'>Memuat…</p>
          ) : (
            <form onSubmit={saveName} className='space-y-3'>
              <Field className='gap-2'>
                <FieldLabel htmlFor='pf-name'>Nama</FieldLabel>
                <Input
                  id='pf-name'
                  className='rounded-lg'
                  autoComplete='name'
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </Field>
              <Field className='gap-2'>
                <FieldLabel htmlFor='pf-email'>Email</FieldLabel>
                <Input id='pf-email' className='rounded-lg' value={me.email} disabled readOnly />
              </Field>
              <p className='text-muted-foreground font-mono text-[11px]'>
                Terdaftar{' '}
                {new Date(me.created_at).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
              <Button type='submit' disabled={savingName}>
                {savingName ? 'Menyimpan…' : 'Simpan Perubahan'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className='max-w-lg'>
        <CardHeader>
          <CardTitle className='font-semibold tracking-[-0.02em]'>Ganti password</CardTitle>
          <CardDescription>
            Akun yang masuk via Google tidak memiliki password — form ini hanya untuk akun email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePw} className='space-y-3'>
            <Field className='gap-2'>
              <FieldLabel htmlFor='pf-old'>Password lama</FieldLabel>
              <Input
                id='pf-old'
                type='password'
                className='rounded-lg'
                autoComplete='current-password'
                value={oldPw}
                onChange={e => setOldPw(e.target.value)}
              />
            </Field>
            <Field className='gap-2'>
              <FieldLabel htmlFor='pf-new'>Password baru (min 8 karakter)</FieldLabel>
              <Input
                id='pf-new'
                type='password'
                className='rounded-lg'
                autoComplete='new-password'
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
              />
            </Field>
            <Button type='submit' disabled={pwBusy}>
              {pwBusy ? 'Menyimpan…' : 'Simpan Password Baru'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default ProfileView
