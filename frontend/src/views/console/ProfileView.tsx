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
    </div>
  )
}

export default ProfileView
