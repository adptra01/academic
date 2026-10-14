'use client'

// React Imports
import { useEffect, useState } from 'react'

// Component Imports
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Util Imports
import { api } from '@/lib/api'

type Me = { id: string; email: string; name: string; created_at: string }

const ProfileView = () => {
  const [me, setMe] = useState<Me | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api<Me>(`/api/v1/auth/me`)
      .then(setMe)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Gagal memuat profil'))
  }, [])

  return (
    <div className='space-y-5'>
      <div>
        <h1 className='text-3xl leading-[1.05] font-bold tracking-[-0.03em]'>Profil</h1>
        <p className='text-muted-foreground mt-2 text-[13px] leading-relaxed'>
          Informasi akun Anda yang tersimpan di platform.
        </p>
      </div>

      {err && (
        <Alert variant='destructive'>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      <Card className='max-w-lg'>
        <CardHeader>
          <CardTitle className='font-semibold tracking-[-0.02em]'>Data diri</CardTitle>
          <CardDescription>Diambil dari sesi login aktif.</CardDescription>
        </CardHeader>
        <CardContent>
          {!me ? (
            <p className='text-muted-foreground text-sm'>Memuat…</p>
          ) : (
            <dl className='space-y-3 text-sm'>
              <div className='flex justify-between gap-4'>
                <dt className='text-muted-foreground'>Nama</dt>
                <dd className='font-medium'>{me.name}</dd>
              </div>
              <div className='flex justify-between gap-4'>
                <dt className='text-muted-foreground'>Email</dt>
                <dd className='font-medium'>{me.email}</dd>
              </div>
              <div className='flex justify-between gap-4'>
                <dt className='text-muted-foreground'>Terdaftar</dt>
                <dd className='text-muted-foreground font-mono text-[12px]'>
                  {new Date(me.created_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ProfileView
