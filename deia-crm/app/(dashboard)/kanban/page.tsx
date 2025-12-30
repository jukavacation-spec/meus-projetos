'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { ContactModal } from '@/components/contact/ContactModal'

export default function KanbanPage() {
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleCardClick = (contactId: string) => {
    setSelectedContactId(contactId)
    setIsModalOpen(true)
  }

  return (
    <>
      <Header title="Kanban" />
      <div className="h-[calc(100vh-4rem)] p-6">
        <KanbanBoard onCardClick={handleCardClick} />
      </div>

      <ContactModal
        contactId={selectedContactId}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  )
}
