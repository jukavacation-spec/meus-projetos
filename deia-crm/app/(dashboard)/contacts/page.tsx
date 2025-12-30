'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { useContacts } from '@/hooks/useContacts'
import { useKanbanStages } from '@/hooks/useKanbanStages'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPhone } from '@/lib/utils/phone'
import { Users } from 'lucide-react'
import { ContactModal } from '@/components/contact/ContactModal'

export default function ContactsPage() {
  const { contacts, isLoading, refetch } = useContacts()
  const { stages } = useKanbanStages()
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const getStageById = (stageId: string | null) => {
    if (!stageId) return null
    return stages.find(s => s.id === stageId)
  }

  const handleContactClick = (contactId: string) => {
    setSelectedContactId(contactId)
    setIsModalOpen(true)
  }

  return (
    <>
      <Header title="Contatos" />
      <div className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum contato ainda</h3>
            <p className="text-muted-foreground">
              Os contatos serao criados automaticamente quando conversas forem recebidas
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contacts.map((contact) => (
              <Card
                key={contact.id}
                className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handleContactClick(contact.id)}
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={contact.avatar_url || undefined} />
                    <AvatarFallback>
                      {contact.name?.charAt(0)?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {contact.name || 'Sem nome'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatPhone(contact.phone)}
                    </p>
                    {contact.stage_id && (() => {
                      const stage = getStageById(contact.stage_id)
                      return stage ? (
                        <Badge
                          variant="secondary"
                          className="text-xs mt-2"
                          style={{
                            backgroundColor: stage.color + '20',
                            color: stage.color,
                            borderColor: stage.color
                          }}
                        >
                          <div
                            className="w-2 h-2 rounded-full mr-1"
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </Badge>
                      ) : null
                    })()}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ContactModal
        contactId={selectedContactId}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onContactUpdated={refetch}
      />
    </>
  )
}
