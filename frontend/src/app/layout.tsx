// React Imports
import type { ReactNode } from 'react'

// Next Imports
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

// Third-party Imports
import { NuqsAdapter } from 'nuqs/adapters/next/app'

// Component Imports
import Providers from '@/components/Providers'
import { TooltipProvider } from '@/components/ui/tooltip'

// Util Imports
import { cn } from '@/lib/utils'

// Style Imports
import 'katex/dist/katex.min.css'
import './globals.css'
import ScrollToTop from '@/components/layout/ScrollToTop'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: 'Academic Research Platform — Mesin Statistik Deterministik',
  description:
    'Platform analisis kuantitatif untuk peneliti: 15 metode statistik terverifikasi, deteksi asumsi otomatis, dan setiap analisis dapat direproduksi lewat Analysis ID + result_hash.',
  metadataBase: new URL(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}`),
  openGraph: {
    title: 'Academic Research Platform',
    description:
      'Platform analisis kuantitatif untuk peneliti: 15 metode statistik terverifikasi dan setiap analisis dapat direproduksi.',
    type: 'website',
    siteName: 'Academic Research Platform',
    url: process.env.NEXT_PUBLIC_APP_URL
  }
}

const RootLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  return (
    <html
      lang='id'
      className={cn(
        geistSans.variable,
        geistMono.variable,
        'flex min-h-full w-full antialiased'
      )}
      data-scroll-behavior='smooth'
      suppressHydrationWarning
    >
      <body className='flex min-h-full w-full flex-auto flex-col'>
        <NuqsAdapter>
          <Providers>
            <TooltipProvider>{children}</TooltipProvider>
          </Providers>
        </NuqsAdapter>

        <ScrollToTop />
      </body>
    </html>
  )
}

export default RootLayout
