'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { AuthProvider } from '@/contexts/AuthContext'

const SIDEBAR_STORAGE_KEY = 'faldesk-sidebar-collapsed'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isInbox = pathname === '/inbox' || pathname.startsWith('/inbox/')

  // Load sidebar state from localStorage - default to expanded (false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (saved !== null) {
      setSidebarCollapsed(JSON.parse(saved))
    }
  }, [])

  const handleToggleSidebar = () => {
    const newState = !sidebarCollapsed
    setSidebarCollapsed(newState)
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(newState))
  }

  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggleSidebar} />
        <main className={`flex-1 overflow-hidden ${isInbox ? '' : 'overflow-y-auto bg-muted/30'}`}>
          {children}
        </main>
      </div>
    </AuthProvider>
  )
}
