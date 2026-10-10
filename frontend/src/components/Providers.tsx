// React Imports
import type { ReactNode } from 'react'

// Component Imports
import { ThemeProvider } from './ThemeProvider'
import { TooltipProvider } from './ui/tooltip'

type Props = {
  children: ReactNode
}

/**
 * Provider global (tema + tooltip). Shell sidebar TIDAK di sini: ia hanya
 * dipakai layout `(pages)` supaya halaman publik & auth tidak ikut ter-
 * bungkus wrapper flex sidebar.
 */
const Providers = ({ children }: Props) => {
  return (
    <ThemeProvider attribute='class' defaultTheme='system' enableSystem={true}>
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeProvider>
  )
}

export default Providers
