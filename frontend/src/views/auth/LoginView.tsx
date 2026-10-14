'use client'

// React Imports
import { useEffect, useState } from 'react'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { EyeIcon, EyeOffIcon } from 'lucide-react'

// Component Imports
import Logo from '@/components/shared/Logo'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Separator } from '@/components/ui/separator'

// Util Imports
import { apiUrl, fetchWithContext } from '@/lib/api'
import { validEmail, validRequired } from '@/lib/validation'

// SVG Import
import AuthBackgroundShape from '@/assets/svg/auth-background-shape'

const LoginView = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [apiUrlVal, setApiUrlVal] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [err, setErr] = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [pwErr, setPwErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Baca/fetch sistem eksternal (localStorage/API/CSS var) saat mount atau saat dependensi berubah; lazy state di render akan menyebabkan hydration mismatch.
    setApiUrlVal(
      window.localStorage.getItem('api_url') ||
        process.env.NEXT_PUBLIC_API_URL ||
        'http://localhost:8100'
    )
  }, [])

  async function googleLogin() {
    setErr('')

    try {
      const { api } = await import('@/lib/api')
      const j = await api<{ url: string }>(`/api/v1/auth/google/url`)

      window.location.href = j.url
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Login Google gagal dimulai')
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const em = validEmail(email)
    const pw = validRequired(password, 'Password')

    setEmailErr(em ?? '')
    setPwErr(pw ?? '')
    setErr('')
    if (em || pw) return
    setBusy(true)

    try {
      window.localStorage.setItem('api_url', apiUrlVal.replace(/\/$/, ''))

      const res = await fetchWithContext(`${apiUrlVal.replace(/\/$/, '')}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      let j: { detail?: string; access_token?: string; user?: { name?: string; email?: string } }

      try {
        j = await res.json()
      } catch {
        throw new Error(
          `Server membalas ${res.status} tanpa JSON. Cek ${apiUrlVal}/health — untuk DDEV host-side biasanya http://localhost:8100.`
        )
      }

      if (!res.ok) throw new Error(j.detail || `HTTP ${res.status}`)
      if (!j.access_token) throw new Error('Server tidak mengembalikan access_token')
      window.localStorage.setItem('token', j.access_token)
      if (j.user) window.localStorage.setItem('user', JSON.stringify(j.user))
      window.location.href = '/dashboard'
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Login gagal')
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
            <CardTitle className='mb-2 text-3xl leading-[1.05] font-bold tracking-[-0.03em]'>Masuk</CardTitle>
            <CardDescription className='text-base'>
              Satu akun untuk menyimpan dataset, variabel, dan riwayat analisis penelitian Anda.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className='px-6'>
          <div className='space-y-4'>
            <form onSubmit={submit}>
              <FieldGroup className='gap-4'>
                <Field className='gap-2'>
                  <FieldLabel htmlFor='email' className='leading-5'>
                    Email
                  </FieldLabel>
                  <Input
                    type='email'
                    className='rounded-lg'
                    id='email'
                    autoComplete='username'
                    placeholder='nama@kampus.ac.id'
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    aria-invalid={!!emailErr}
                  />
                  {emailErr && <p className='text-destructive text-xs'>{emailErr}</p>}
                </Field>
                <Field className='w-full gap-2'>
                  <FieldLabel htmlFor='password' className='leading-5'>
                    Password
                  </FieldLabel>
                  <InputGroup className='rounded-lg'>
                    <InputGroupInput
                      id='password'
                      type={showPw ? 'text' : 'password'}
                      autoComplete='current-password'
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      aria-invalid={!!pwErr}
                    />
                    <InputGroupAddon align='inline-end' className='pr-1.5'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        onClick={() => setShowPw(v => !v)}
                        className='text-muted-foreground rounded-l-none hover:bg-transparent'
                      >
                        {showPw ? <EyeOffIcon /> : <EyeIcon />}
                        <span className='sr-only'>{showPw ? 'Sembunyikan password' : 'Tampilkan password'}</span>
                      </Button>
                    </InputGroupAddon>
                  </InputGroup>
                  {pwErr && <p className='text-destructive text-xs'>{pwErr}</p>}
                </Field>
                {err && (
                  <Alert variant='destructive'>
                    <AlertDescription>{err}</AlertDescription>
                  </Alert>
                )}
                <Field>
                  <Button className='w-full' type='submit' disabled={busy}>
                    {busy ? 'Masuk…' : 'Masuk'}
                  </Button>
                </Field>
              </FieldGroup>
            </form>

            <p className='text-muted-foreground text-center text-base'>
              Belum punya akun?{' '}
              <Link href='/register' className='text-card-foreground hover:underline'>
                Daftar
              </Link>
            </p>

            <div className='flex items-center gap-4'>
              <Separator className='flex-1' />
              <p className='text-base'>atau</p>
              <Separator className='flex-1' />
            </div>

            <Button variant='outline' className='w-full' type='button' onClick={() => void googleLogin()}>
              Masuk dengan Google
            </Button>
            <p className='text-muted-foreground text-center text-xs'>
              Membutuhkan konfigurasi Google Cloud client di sisi server.
            </p>

            <details>
              <summary className='cursor-pointer text-sm font-medium hover:underline'>
                API tidak bisa dihubungi?
              </summary>
              <div className='mt-3 space-y-3 rounded-xl border p-4'>
                <Field className='gap-2'>
                  <FieldLabel htmlFor='api-url' className='leading-5'>
                    URL API
                  </FieldLabel>
                  <Input id='api-url' className='rounded-lg' value={apiUrlVal} onChange={e => setApiUrlVal(e.target.value)} />
                  <p className='text-muted-foreground text-xs'>
                    DDEV memetakan backend container ke host <span className='font-mono'>localhost:8100</span> —
                    bukan 8000. Cek <span className='font-mono'>{apiUrlVal}/health</span> di tab baru.
                  </p>
                </Field>
                <a
                  href={`${apiUrl()}/health`}
                  target='_blank'
                  rel='noreferrer'
                  className='text-sm font-medium text-primary hover:underline'
                >
                  Buka /health
                </a>
              </div>
            </details>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginView
