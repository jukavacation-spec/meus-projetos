'use client'

import { useState } from 'react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'
import { GlobalSearch, GlobalSearchButton } from '@/components/search/GlobalSearch'

interface HeaderProps {
  title?: string
  children?: React.ReactNode
}

export function Header({ title, children }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b bg-card px-6">
        <div className="flex items-center gap-4">
          {title && (
            <h1 className="text-xl font-semibold">{title}</h1>
          )}
          {children}
        </div>

        <div className="flex items-center gap-2">
          {/* Global Search */}
          <div className="hidden sm:block">
            <GlobalSearchButton onClick={() => setSearchOpen(true)} />
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <NotificationDropdown />
        </div>
      </header>

      {/* Global Search Dialog */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
