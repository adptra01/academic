'use client'

// React Imports
import { useEffect, useState } from 'react'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { LayoutDashboardIcon, LogOutIcon } from 'lucide-react'

// Component Imports
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

// Util Imports
import { apiUrl } from '@/lib/api'

type StoredUser = { name?: string; email?: string } | null

function initialsOf(name?: string, email?: string) {
  const base = (name || email || '?').trim()
  const parts = base.split(/\s+/)

  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()

  return base.slice(0, 2).toUpperCase()
}

const ProfileDropdown = () => {
  const [user, setUser] = useState<StoredUser>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('user')

      // eslint-disable-next-line react-hooks/set-state-in-effect -- Baca/fetch sistem eksternal (localStorage/API/CSS var) saat mount atau saat dependensi berubah; lazy state di render akan menyebabkan hydration mismatch.
      setUser(raw ? (JSON.parse(raw) as StoredUser) : null)
    } catch {
      setUser(null)
    }
  }, [])

  async function logout() {
    setBusy(true)

    try {
      const token = window.localStorage.getItem('token')

      await fetch(`${apiUrl()}/api/v1/auth/logout`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
    } catch {
      /* abaikan — token lokal tetap dibersihkan */
    }

    window.localStorage.removeItem('token')
    window.localStorage.removeItem('user')
    window.location.href = '/login'
  }

  const display = user?.name || user?.email || 'Peneliti'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant='ghost' size='icon' className='relative rounded-full hover:bg-transparent' />}
      >
        <Avatar>
          <AvatarFallback>{initialsOf(user?.name, user?.email)}</AvatarFallback>
        </Avatar>
        <span className='ring-card absolute right-0 bottom-0 block size-2 rounded-full bg-green-600 ring-2' />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-60'>
        <DropdownMenuGroup>
          <DropdownMenuLabel className='flex items-center gap-4 px-2 py-2.5 font-normal'>
            <div className='relative'>
              <Avatar className='size-10'>
                <AvatarFallback>{initialsOf(user?.name, user?.email)}</AvatarFallback>
              </Avatar>
              <span className='ring-card absolute right-0 bottom-0 block size-2 rounded-full bg-green-600 ring-2' />
            </div>
            <div className='flex min-w-0 flex-1 flex-col items-start'>
              <span className='text-foreground truncate text-base font-semibold'>{display}</span>
              {user?.email && (
                <span className='text-muted-foreground truncate text-sm'>{user.email}</span>
              )}
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href='/dashboard' />}>
            <LayoutDashboardIcon />
            <span>Dashboard</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            variant='destructive'
            disabled={busy}
            onClick={() => void logout()}
          >
            <LogOutIcon />
            <span>{busy ? 'Keluar…' : 'Keluar'}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ProfileDropdown
