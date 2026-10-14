'use client'

// React Imports
import { useEffect } from 'react'

// Next Imports
import Link from 'next/link'

// Component Imports
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/** Boundary khusus detail project: gagal fetch tidak membunuh chrome + bisa retry. */
const ProjectError = ({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) => {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <Alert variant='destructive'>
      <AlertTitle>Gagal memuat project</AlertTitle>
      <AlertDescription className='mt-1'>{error.message}</AlertDescription>
      <div className='mt-3 flex gap-2'>
        <Button variant='outline' size='sm' onClick={() => reset()}>
          Coba lagi
        </Button>
        <Button variant='link' size='sm' render={<Link href='/projek' />} nativeButton={false}>
          Kembali ke daftar projek
        </Button>
      </div>
    </Alert>
  )
}

export default ProjectError
