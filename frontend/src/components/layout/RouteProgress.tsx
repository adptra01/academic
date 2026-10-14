'use client'

// React Imports
import { Suspense, useEffect, useState } from 'react'

// Next Imports
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Bar loading tipis di paling atas layar (ala website modern) yang muncul
 * setiap pindah halaman dan selesai saat halaman baru ter-render.
 *
 * App Router tidak punya router events, jadi pola yang dipakai:
 * - MULAI: intersepsi klik link internal (capture) + tombol back/forward.
 * - SELESAI: `pathname`/`searchParams` berubah = navigasi tiba.
 */
const RouteProgressInner = () => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<'idle' | 'active' | 'done'>('idle')

  // Navigasi tiba → animasi selesai lalu hilang.
  useEffect(() => {
    if (phase !== 'active') return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Transisi penyelesaian progress bar saat pathname/search berubah (sinyal navigasi tiba dari router).
    setPhase('done')
    const t = setTimeout(() => setPhase('idle'), 450)

    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Hanya pathname/search yang menandai navigasi tiba; `phase` dibaca sebagai guard.
  }, [pathname, searchParams])

  // Navigasi mulai → tampilkan bar.
  useEffect(() => {
    const start = () => setPhase('active')

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const el = e.target instanceof HTMLElement ? e.target.closest('a[href]') : null

      if (!(el instanceof HTMLAnchorElement)) return
      const raw = el.getAttribute('href')

      if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return
      if (el.target === '_blank' || el.hasAttribute('download')) return

      let url: URL

      try {
        url = new URL(el.href)
      } catch {
        return
      }

      if (url.origin !== window.location.origin) return

      // Pindah hash di halaman yang sama bukan navigasi.
      if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return

      start()
    }

    const onPopState = () => start()

    document.addEventListener('click', onClick)
    window.addEventListener('popstate', onPopState)

    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  if (phase === 'idle') return null

  return (
    <div aria-hidden className='fixed inset-x-0 top-0 z-[100] h-0.5'>
      <div className={phase === 'active' ? 'route-progress-active' : 'route-progress-done'} />
    </div>
  )
}

/** `useSearchParams` wajib di dalam Suspense (aturan Next). */
const RouteProgress = () => {
  return (
    <Suspense fallback={null}>
      <RouteProgressInner />
    </Suspense>
  )
}

export default RouteProgress
