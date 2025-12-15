'use client'

export const dynamic = 'force-dynamic'

import { Header } from '@/components/layout/Header'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'

export default function KanbanPage() {
  return (
    <>
      <Header title="Kanban" />
      <div className="h-[calc(100vh-4rem)] p-6">
        <KanbanBoard />
      </div>
    </>
  )
}
