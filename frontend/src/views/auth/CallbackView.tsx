'use client'

// React Imports
import { useEffect, useState } from 'react'

// Component Imports
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Util Imports
import { apiUrl, fetchWithContext } from '@/lib/api'

/** Callback OAuth Google: tukar ?code= menjadi sesi JWT internal. */
const CallbackView = () => {
  const [err, setErr] = useState('')

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      setErr('Tidak ada authorization code dari Google.')
      return
    }
    fetchWithContext(`${apiUrl()}/api/v1/auth/google/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
      .then(async res => {
        const j = await res.json()
        if (!res.ok) throw new Error(j.detail || `HTTP ${res.status}`)
        window.localStorage.setItem('token', j.access_token)
        if (j.user) window.localStorage.setItem('user', JSON.stringify(j.user))
        window.location.href = '/dashboard'
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Callback gagal'))
  }, [])

  return (
    <div className='relative flex h-auto min-h-screen items-center justify-center px-4 py-10'>
      <Card className='z-1 w-full sm:max-w-md'>
        <CardHeader>
          <CardTitle>Login Google</CardTitle>
        </CardHeader>
        <CardContent>
          {err ? (
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
