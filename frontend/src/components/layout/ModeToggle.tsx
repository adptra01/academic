'use client'

// Third-party Imports
import { useTheme } from 'next-themes'
import { MoonStarIcon, SunIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/components/ui/button'

// Util Imports
import { cn } from '@/lib/utils'

type ModeToggleProps = {
  className?: string
  /** Tampilkan teks (dipakai di menu mobile) alih-alih tombol ikon saja. */
  withLabel?: boolean
}

const ModeToggle = ({ className, withLabel = false }: ModeToggleProps) => {
  const { setTheme, resolvedTheme } = useTheme()

  const handleModeChange = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  if (withLabel) {
    return (
      <button
        type='button'
        onClick={handleModeChange}
        className={cn(
          'pressable ring-accent inline-flex items-center gap-2 rounded-full border border-rule-2 px-4 py-2.5 text-[13.5px] font-medium text-ink transition-colors duration-200 hover:bg-paper-2',
          className
        )}
      >
        <MoonStarIcon className='size-4 dark:hidden' />
        <SunIcon className='hidden size-4 dark:block' />
        {/* label via CSS agar tidak ada mismatch hidrasi */}
        <span className='dark:hidden'>Mode gelap</span>
        <span className='hidden dark:inline'>Mode terang</span>
      </button>
    )
  }

  return (
    <Button variant='ghost' size='icon' className={cn('relative', className)} onClick={handleModeChange}>
      <MoonStarIcon className='scale-100 dark:scale-0' />
      <SunIcon className='absolute scale-0 dark:scale-100' />
      <span className='sr-only'>Toggle theme</span>
    </Button>
  )
}

export default ModeToggle
