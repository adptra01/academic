import * as React from 'react'

const MOBILE_BREAKPOINT = 1280

export function useIsMobile() {
  // Nilai awal undefined di server MAUPUN render pertama client, supaya HTML
  // hasil SSR selalu cocok (cabang desktop). Nilai sebenarnya diisi di effect
  // setelah mount. Inisialisasi lazy dari window.innerWidth justru bikin
  // hydration mismatch saat viewport < breakpoint.
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)

    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    mql.addEventListener('change', onChange)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Sinkronisasi media-query sekali setelah mount; inisialisasi lazy dari window justru menyebabkan hydration mismatch.
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)

    return () => mql.removeEventListener('change', onChange)
  }, [])

  return !!isMobile
}
