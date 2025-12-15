'use client'

export const dynamic = 'force-dynamic'

import { Header } from '@/components/layout/Header'
import { useConversations } from '@/hooks/useConversations'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPhone } from '@/lib/utils/phone'
import { MessageSquare } from 'lucide-react'

export default function InboxPage() {
  const { conversations, isLoading } = useConversations()

  return (
    <>
      <Header title="Inbox" />
      <div className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <Card className="p-12 text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma conversa ainda</h3>
            <p className="text-muted-foreground">
              As conversas aparecerao aqui quando forem recebidas pelo Chatwoot
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <Link key={conversation.id} href={`/inbox/${conversation.id}`}>
                <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={conversation.contact?.avatar_url || undefined} />
                      <AvatarFallback>
                        {conversation.contact?.name?.charAt(0)?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium truncate">
                          {conversation.contact?.name || 'Sem nome'}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(conversation.last_activity_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate">
                          {conversation.contact?.phone ? formatPhone(conversation.contact.phone) : 'Sem telefone'}
                        </p>
                        <div className="flex items-center gap-2">
                          {conversation.stage && (
                            <Badge
                              variant="secondary"
                              style={{ backgroundColor: conversation.stage.color + '20', color: conversation.stage.color }}
                            >
                              {conversation.stage.name}
                            </Badge>
                          )}
                          <Badge variant={conversation.status === 'open' ? 'default' : 'secondary'}>
                            {conversation.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
