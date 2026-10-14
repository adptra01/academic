// React Imports
import { Suspense } from 'react'
import type { ReactNode } from 'react'

// Component Imports
import PagesShell from '@/components/layout/PagesShell'

/**
 * Layout segmen `(pages)` — Server Component (tanpa `'use client'`).
 * Interaktivitas (sidebar/viewport/cookie) tinggal di `PagesShell`; halaman
 * (`children`) tetap RSC sehingga navigasi `/projects/[id]` punya payload
 * untuk `fetchServerResponse` dan tidak lagi `Failed to fetch`.
 */
const PagesLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  return (
    <Suspense>
      <PagesShell>{children}</PagesShell>
    </Suspense>
  )
}

export default PagesLayout
