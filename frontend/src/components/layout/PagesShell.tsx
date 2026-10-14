'use client'

// React Imports
import { Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

// Component Imports
import Footer from '@/components/layout/Footer'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { Toaster } from '@/components/ui/sonner'

/**
 * Chrome interaktif segmen `(pages)`: sidebar + header + footer.
 * Sengaja SATU-SATUNYA `'use client'` di level layout — page/layout di atasnya
 * tetap Server Component sehingga payload RSC mengalir (aturan 8.1/8.2 skill).
 *
 * Berbeda dari gate lama yang menyembunyikan `children` sampai mount (itu yang
 * membuat RSC `/projects/[id]` kosong lalu router melempar `Failed to fetch`
 * di `fetchMissingDynamicData`), di sini `children` SELALU di-render. Yang
 * di-gate hanya chrome yang bergantung viewport/cookie (sidebar), diganti
 * skeleton berdimensi sama agar tidak CLS (aturan 6.4).
 */
const PagesShell = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Tandai mount sekali; chrome pra-mount sengaja statis agar cocok dengan SSR.
    setMounted(true)
  }, [])

  return (
    <SidebarProvider defaultOpen>
      <div className='flex h-full w-full min-w-0'>
        {mounted ? (
          <Suspense fallback={<SidebarSkeleton />}>
            <Sidebar />
          </Suspense>
        ) : (
          <SidebarSkeleton />
        )}
        <SidebarInset className='flex flex-1 flex-col'>
          <Header />
          <main className='mx-auto size-full max-w-360 flex-1 px-4 py-6 sm:px-6'>{children}</main>
          <Toaster />
          <Footer />
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

/** Skeleton sidebar — dimensi mirip rail sidebar agar tidak layout-shift. */
const SidebarSkeleton = () => {
  return (
    <div className='hidden w-64 shrink-0 flex-col gap-2 border-r p-4 md:flex' aria-hidden>
      <Skeleton className='h-10 w-3/4' />
      <Skeleton className='h-8 w-full' />
      <Skeleton className='h-8 w-full' />
      <Skeleton className='h-8 w-5/6' />
      <Skeleton className='h-8 w-full' />
    </div>
  )
}

export default PagesShell
