'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDownIcon } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
  variant?: 'default' | 'warning'
  className?: string
}

export function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  variant = 'default',
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden transition-all',
        variant === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-card border-border',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors',
          variant === 'warning' ? 'hover:bg-yellow-100' : ''
        )}
        aria-expanded={open}
      >
        <Icon className={cn('size-4 shrink-0', variant === 'warning' ? 'text-yellow-600' : 'text-muted-foreground')} aria-hidden="true" />
        <span className="font-semibold text-sm flex-1">{title}</span>
        <ChevronDownIcon
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        )}
        style={{ overflow: 'hidden' }}
      >
        <div className="px-4 pb-4 pt-0 border-t border-border/50">
          {children}
        </div>
      </div>
    </div>
  )
}