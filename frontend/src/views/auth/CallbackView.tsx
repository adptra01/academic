'use client'

// React Imports
import { useEffect, useState } from 'react'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { ArrowRightIcon } from 'lucide-react'

// Component Imports
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Util Imports
import { apiUrl, fetchWithContext } from '@/lib/api'

/** Callback OAuth: Google-login (OAuth A) atau koneksi YouTube (OAuth B).
 * Google mengembalikan keduanya ke redirect_uri yang sama — dibedakan dari
 * pesan state: state youtube ditolak google/callback lalu ditukar di
 * /oauth/youtube/callback menjadi koneksi tersimpan. */
const CallbackView = () => {
  const [err, setErr] = useState('')
  const [ytOk, setYtOk] = useState('')
  const [backTo, setBackTo] = useState('/dashboard')

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search)
    const code = qs.get('code')
    const state = qs.get('state')

    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Baca/fetch sistem eksternal (localStorage/API/CSS var) saat mount atau saat dependensi berubah; lazy state di render akan menyebabkan hydration mismatch.
      setErr('Tidak ada authorization code dari Google.')

      return
    }

    if (!state) {
       
      setErr('Parameter state hilang — kemungkinan sesi login kedaluwarsa. Ulangi dari tombol login.')

      return
    }

    fetchWithContext(`${apiUrl()}/api/v1/auth/google/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state })
    })
      .then(async res => {
        const j = await res.json()

        if (!res.ok) {
          // Bukan state login? Coba sebagai state koneksi YouTube (OAuth B).
          if (res.status === 401 && /tidak cocok untuk provider|tidak dikenal/i.test(j.detail || '')) {
            return void exchangeYoutube(code, state)
          }

          throw new Error(j.detail || `HTTP ${res.status}`)
        }

        window.localStorage.setItem('token', j.access_token)
        if (j.user) window.localStorage.setItem('user', JSON.stringify(j.user))
        window.location.href = '/dashboard'
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Callback gagal'))

    async function exchangeYoutube(c: string, s: string) {
      const { api } = await import('@/lib/api')

      try {
        await api(`/api/v1/oauth/youtube/callback`, {
          method: 'POST',
          body: JSON.stringify({ code: c, state: s })
        })
        setBackTo(window.sessionStorage.getItem('yt_return') || '/dashboard')
        setYtOk('Akun YouTube terhubung — mode OAuth siap dipakai untuk YouTube Data API.')
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Koneksi YouTube gagal')
      }
    }
  }, [])

  return (
    <div className='relative flex h-auto min-h-screen items-center justify-center px-4 py-10'>
      <Card className='z-1 w-full sm:max-w-md'>
        <CardHeader>
          <CardTitle className='font-semibold tracking-[-0.02em]'>Login Google</CardTitle>
        </CardHeader>
        <CardContent>
          {ytOk ? (
            <div className='space-y-3'>
              <Alert>
                <AlertDescription>{ytOk}</AlertDescription>
              </Alert>
              <Button render={<Link href={backTo} />} nativeButton={false}>
                Kembali
                <ArrowRightIcon />
              </Button>
            </div>
          ) : err ? (
            <Alert variant='destructive'>
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          ) : (
            <p className='text-muted-foreground text-sm'>Memverifikasi dengan Google…</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default CallbackView
