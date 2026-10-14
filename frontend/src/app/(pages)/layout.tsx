'use client'

// React Imports
import { Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

// Component Imports
import Footer from '@/components/layout/Footer'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'

const PagesLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  // Sidebar + header membaca state client-only (lebar viewport, cookie
  // sidebar_state, localStorage user). Render subtree itu hanya setelah mount
  // supaya HTML server dan render pertama client SELALU identik — tidak ada
  // lagi hydration mismatch apa pun penyebabnya (viewport, cookie lama,
  // ekstensi browser).
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Tandai mount sekali; render pra-mount sengaja statis agar cocok dengan SSR.
    setMounted(true)
  }, [])

  return (
    <SidebarProvider defaultOpen>
      <div className='flex h-full w-full min-w-0'>
        {mounted ? (
          <>
            <Suspense>
              <Sidebar />
            </Suspense>
            <SidebarInset className='flex flex-1 flex-col'>
              <Header />
              <main className='mx-auto size-full max-w-360 flex-1 px-4 py-6 sm:px-6'>{children}</main>
              <Toaster />
              <Footer />
            </SidebarInset>
          </>
        ) : (
          <div className='flex flex-1 items-center justify-center p-10' aria-hidden>
            <p className='text-muted-foreground text-sm'>Memuat…</p>
          </div>
        )}
      </div>
    </SidebarProvider>
  )
}

export default PagesLayout
