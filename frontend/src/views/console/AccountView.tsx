'use client'

// React Imports
import { useState } from 'react'

// Component Imports
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

// Util Imports
import { api } from '@/lib/api'

const AccountView = () => {
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function changePw(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setMsg('')

    if (newPw.length < 8) {
      setErr('Password baru minimal 8 karakter.')

      return
    }

    setBusy(true)

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
      setBusy(false)
    }
  }

  return (
    <div className='space-y-5'>
      <div>
        <h1 className='text-3xl leading-[1.05] font-bold tracking-[-0.03em]'>Akun</h1>
        <p className='text-muted-foreground mt-2 text-[13px] leading-relaxed'>
          Kelola keamanan akun Anda.
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
          <CardTitle className='font-semibold tracking-[-0.02em]'>Ganti password</CardTitle>
          <CardDescription>
            Akun yang masuk via Google tidak memiliki password — form ini hanya untuk akun email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePw} className='space-y-3'>
            <Field className='gap-2'>
              <FieldLabel htmlFor='old'>Password lama</FieldLabel>
              <Input
                id='old'
                type='password'
                className='rounded-lg'
                autoComplete='current-password'
                value={oldPw}
                onChange={e => setOldPw(e.target.value)}
              />
            </Field>
            <Field className='gap-2'>
              <FieldLabel htmlFor='new'>Password baru (min 8 karakter)</FieldLabel>
              <Input
                id='new'
                type='password'
                className='rounded-lg'
                autoComplete='new-password'
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
              />
            </Field>
            <Button type='submit' disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan Password Baru'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default AccountView
