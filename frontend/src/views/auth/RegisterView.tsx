'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import Link from 'next/link'

// Component Imports
import Logo from '@/components/shared/Logo'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

// Util Imports
import { apiUrl, fetchWithContext } from '@/lib/api'

// SVG Import
import AuthBackgroundShape from '@/assets/svg/auth-background-shape'

const RegisterView = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const res = await fetchWithContext(`${apiUrl()}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.detail || `HTTP ${res.status}`)
      window.localStorage.setItem('token', j.access_token)
      if (j.user) window.localStorage.setItem('user', JSON.stringify(j.user))
      window.location.href = '/dashboard'
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Registrasi gagal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='relative flex h-auto min-h-screen items-center justify-center overflow-x-hidden px-4 py-10 sm:px-6 lg:px-8'>
      <div className='absolute'>
        <AuthBackgroundShape />
      </div>

      <Card className='z-1 w-full gap-6 py-6 sm:max-w-lg'>
        <CardHeader className='gap-6 px-6'>
          <Link href='/'>
            <Logo className='gap-3' />
          </Link>
          <div>
            <CardTitle className='mb-2 text-2xl font-semibold'>Buat akun</CardTitle>
            <CardDescription className='text-base'>
              Daftar untuk mulai menyimpan penelitian Anda.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className='px-6'>
          <div className='space-y-4'>
            <form onSubmit={submit}>
              <FieldGroup className='gap-4'>
                <Field className='gap-2'>
                  <FieldLabel htmlFor='name' className='leading-5'>
                    Nama
                  </FieldLabel>
                  <Input
                    id='name'
                    autoComplete='name'
                    placeholder='Nama lengkap'
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </Field>
                <Field className='gap-2'>
                  <FieldLabel htmlFor='email' className='leading-5'>
                    Email
                  </FieldLabel>
                  <Input
                    type='email'
                    id='email'
                    autoComplete='username'
                    placeholder='nama@kampus.ac.id'
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </Field>
                <Field className='gap-2'>
                  <FieldLabel htmlFor='password' className='leading-5'>
                    Password (min 8 karakter)
                  </FieldLabel>
                  <Input
                    type='password'
                    id='password'
                    autoComplete='new-password'
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </Field>
                {err && (
                  <Alert variant='destructive'>
                    <AlertDescription>{err}</AlertDescription>
                  </Alert>
                )}
                <Field>
                  <Button className='w-full' type='submit' disabled={busy}>
                    {busy ? 'Mendaftar…' : 'Daftar'}
                  </Button>
                </Field>
              </FieldGroup>
            </form>

            <p className='text-muted-foreground text-center text-base'>
              Sudah punya akun?{' '}
              <Link href='/login' className='text-card-foreground hover:underline'>
                Masuk
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default RegisterView
