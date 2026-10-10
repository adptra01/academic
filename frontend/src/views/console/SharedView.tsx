'use client'

// React Imports
import { useEffect, useState } from 'react'

// Next Imports
import { useParams } from 'next/navigation'

// Component Imports
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Util Imports
import { apiUrl, fetchWithContext } from '@/lib/api'

type Shared = {
  analysis_uid: string
  method: string
  variables: Record<string, unknown>
  dataset: { filename: string | null; version: number | null }
  result: {
    method_name?: string
    statistics?: Record<string, unknown>
    decision?: { text: string } | null
    interpretation?: string
  } | null
  result_hash: string
  software_version: string
  timestamp: string
}

const SharedView = () => {
  const params = useParams()
  const token = Array.isArray(params?.token) ? params.token[0] : (params?.token as string)
  const [d, setD] = useState<Shared | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!token) return
    fetchWithContext(`${apiUrl()}/public/shared/${token}`)
      .then(async r => {
        if (!r.ok) throw new Error('Link tidak valid / dicabut / kedaluwarsa')

        return r.json()
      })
      .then(setD)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Gagal'))
  }, [token])

  if (err)
    return (
      <Alert variant='destructive'>
        <AlertDescription>{err}</AlertDescription>
      </Alert>
    )
  if (!d) return <p className='text-muted-foreground'>Memuat...</p>

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-3xl leading-[1.05] font-bold tracking-[-0.03em]'>{d.result?.method_name || d.method}</h1>
        <p className='text-muted-foreground mt-1 font-mono text-xs'>
          Tautan publik read-only · {d.analysis_uid} · dataset {d.dataset.filename} v{d.dataset.version}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className='font-semibold tracking-[-0.02em]'>Hasil</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm'>
            Keputusan:{' '}
            <Badge variant={d.result?.decision?.text === 'Tolak H0' ? 'destructive' : 'default'}>
              {d.result?.decision?.text || '-'}
            </Badge>
          </p>
          <p className='mt-2 text-sm leading-6'>{d.result?.interpretation}</p>
          <p className='text-muted-foreground mt-2 font-mono text-xs'>
            hash: {d.result_hash?.slice(0, 16)}… · {d.software_version} · {d.timestamp}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default SharedView
