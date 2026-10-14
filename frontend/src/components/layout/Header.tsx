// Header memakai `usePathname()` (hook client) sehingga wajib Client Component.
// Sebelumnya ia lolos tanpa direktif hanya karena parent layout kebetulan
// `'use client'` — rapuh dan melanggar koherensi boundary (aturan 9.4 skill).
'use client'

// Third-party Imports
import { Fragment } from 'react'

import { usePathname } from 'next/navigation'

// Component Imports
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import { SidebarTrigger } from '@/components/ui/sidebar'

// Component Imports
import ModeToggle from '@/components/layout/ModeToggle'
import ProfileDropdown from '@/components/shared/ProfileDropdown'

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  analyses: 'Analyses',
  shared: 'Shared',
  auth: 'Auth',
  callback: 'Callback'
}

/** Samarkan UUID di URL jadi bentuk ringkas + awal ("8fd3c2a1-…"). */
const shortId = (s: string): string => (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s) ? `${s.slice(0, 8)}…` : s)

/** Label tanggal Indonesia ringkas: "11 Okt 2026". */
const fmtDateID = (s: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)

  if (!m) return s
  const bln = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

  return `${Number(m[3])} ${bln[Number(m[2]) - 1]} ${m[1]}`
}

const labelFor = (segment: string): string => {
  const known = ROUTE_LABELS[segment.toLowerCase()]

  if (known) return known

  // /analyses/ANL-20261010-2R35I8 -> "ANL 11 Okt 2026 · 2R35I8"
  const anl = /^ANL-(\d{4})(\d{2})(\d{2})-(.+)$/i.exec(segment)

  if (anl) return `ANL ${fmtDateID(`${anl[1]}-${anl[2]}-${anl[3]}`)} · ${anl[4]}`

  // /projects/<uuid> -> UUID ringkas, bukan UUID penuh yang memenuhi layar
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment)) return shortId(segment)

  // /shared/<token> -> "Tautan …<akhir token>"
  if (segment.length > 24) return `${segment.slice(0, 8)}…`

  return segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const Header = () => {
  const pathname = usePathname()

  const segments = pathname.split('/').filter(Boolean)

  return (
    <header className='bg-paper/70 sticky top-0 z-50 backdrop-blur-sm'>
      <div className='mx-auto flex max-w-360 items-center justify-between gap-6 px-4 py-3.5 sm:px-6'>
        <div className='flex items-center gap-4'>
          <SidebarTrigger className='[&_svg]:size-5!' />
          <Separator orientation='vertical' className='hidden h-4! data-vertical:self-center sm:block' />
          <Breadcrumb className='hidden sm:block'>
            <BreadcrumbList>
              {segments.map((segment, index) => {
                const isLast = index === segments.length - 1
                const label = labelFor(segment)
                const href = '/' + segments.slice(0, index + 1).join('/')

                return (
                  <Fragment key={href}>
                    <BreadcrumbItem>
                      {isLast ? <BreadcrumbPage>{label}</BreadcrumbPage> : <BreadcrumbLink href={href}>{label}</BreadcrumbLink>}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className='flex items-center gap-1.5'>
          <ModeToggle />
          <ProfileDropdown />
        </div>
      </div>
    </header>
  )
}

export default Header