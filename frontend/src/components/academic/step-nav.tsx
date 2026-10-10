// Third-party Imports
import { CheckIcon, ChevronRightIcon, LockIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Util Imports
import { cn } from '@/lib/utils'

export type StepStatus = 'done' | 'current' | 'todo' | 'locked'

export type StepItem = {
  key: string
  n: string
  label: string
  hint: string
  icon: LucideIcon
  status: StepStatus
  /** Satu baris hasil, mis. "2 file · v3 aktif". */
  summary?: string
}

type StepNavProps = {
  steps: StepItem[]
  onSelect: (key: string) => void
  className?: string
}

/**
 * Navigasi tahap vertikal untuk alur kerja project (tahap 02–07).
 * Status: done = ceklis, current = solid + aria-current, locked = gembok.
 */
const StepNav = ({ steps, onSelect, className }: StepNavProps) => {
  return (
    <nav aria-label='Tahapan kerja' className={cn('w-full max-w-full min-w-0', className)}>
      <ol className='flex gap-2 overflow-x-auto overscroll-x-contain pb-1 lg:flex-col lg:overflow-visible lg:pb-0'>
        {steps.map(s => {
          const Icon = s.icon
          const locked = s.status === 'locked'
          const current = s.status === 'current'
          const done = s.status === 'done'

          const body = (
            <>
              <span
                aria-hidden='true'
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-200',
                  current && 'bg-primary text-primary-foreground',
                  done && 'bg-muted text-primary',
                  !current && !done && 'bg-muted text-muted-foreground'
                )}
              >
                {locked ? (
                  <LockIcon className='size-3.5' />
                ) : done && !current ? (
                  <CheckIcon className='size-4' strokeWidth={2.25} />
                ) : (
                  <Icon className='size-3.5' />
                )}
              </span>
              <span className='min-w-0 flex-1 text-left leading-tight'>
                <span
                  className={cn(
                    'block truncate text-[13px]',
                    current ? 'font-semibold' : 'font-medium',
                    locked && 'text-muted-foreground'
                  )}
                >
                  {s.label}
                </span>
                <span className='text-muted-foreground mt-0.5 block font-mono text-[11px] font-medium uppercase tracking-[0.2em]'>
                  Tahap {s.n}
                  {s.summary ? ` · ${s.summary}` : ''}
                </span>
              </span>
              {current && <ChevronRightIcon className='size-3.5 shrink-0 text-primary' aria-hidden='true' />}
            </>
          )

          return (
            <li key={s.key} className='min-w-44 flex-1 lg:min-w-0'>
              {locked ? (
                <div
                  aria-disabled='true'
                  title={`${s.label} — ${s.hint} (terkunci: unggah file data dulu)`}
                  className='flex w-full cursor-not-allowed items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 opacity-60'
                >
                  {body}
                </div>
              ) : (
                <button
                  type='button'
                  onClick={() => onSelect(s.key)}
                  aria-current={current ? 'step' : undefined}
                  title={`${s.label} — ${s.hint}`}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
                    current
                      ? 'border-border bg-card shadow-sm'
                      : 'border-transparent hover:border-border hover:bg-muted/60'
                  )}
                >
                  {body}
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default StepNav
