'use client'

// React Imports
import { useEffect } from 'react'

// Component Imports
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/**
 * Menampung kegagalan segmen `(pages)` — termasuk RSC `fetchServerResponse`
 * yang sebelumnya menggelembung sebagai `TypeError: Failed to fetch` tanpa
 * konteks. Chrome (sidebar/header) tetap utuh; pengguna bisa `reset()`.
 */
const PagesError = ({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) => {
  useEffect(() => {
    console.error(error)
  }, [error])

  const isNetwork = /failed to fetch|tidak bisa menghubungi|network/i.test(error.message)

  return (
    <Alert variant='destructive'>
      <AlertTitle>{isNetwork ? 'Tidak bisa memuat halaman' : 'Terjadi kesalahan'}</AlertTitle>
      <AlertDescription className='mt-1'>
        {isNetwork
          ? 'Koneksi ke server terputus saat memuat halaman. Pastikan dev server frontend (port 3100) dan backend (port 8100) berjalan, lalu coba lagi.'
          : error.message}
      </AlertDescription>
      <Button variant='outline' size='sm' className='mt-3' onClick={() => reset()}>
        Coba lagi
      </Button>
    </Alert>
  )
}

export default PagesError
