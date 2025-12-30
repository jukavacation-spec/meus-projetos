'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, UserCheck, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Contact = {
  id: string
  phone: string
  name: string | null
  avatar_url: string | null
}

type Stage = {
  id: string
  name: string
  color: string
}

type Conversation = {
  id: string
  company_id: string
  contact_id: string
  stage_id: string | null
  assigned_to: string | null
  priority: string
  status: string
  subject: string | null
  tags: string[]
  last_activity_at: string
  created_at: string
  contact?: Contact
  stage?: Stage
  chatwoot_inbox_id?: number | null
  last_message?: string | null
  unread_count?: number
}

type AssignedConversationListProps = {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (conversation: Conversation) => void
  totalCount: number
  onSync?: () => Promise<boolean>
}

// Helper function to format message time
function formatMessageTime(date: Date): string {
  const now = new Date()
  const todayStr = now.toLocaleDateString('pt-BR')
  const messageDateStr = date.toLocaleDateString('pt-BR')

  if (todayStr === messageDateStr) {
    return format(date, 'HH:mm', { locale: ptBR })
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toLocaleDateString('pt-BR')

  if (yesterdayStr === messageDateStr) {
    return 'ontem'
  }

  return format(date, 'dd/MM', { locale: ptBR })
}

export function AssignedConversationList({
  conversations,
  selectedId,
  onSelect,
  totalCount,
  onSync
}: AssignedConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async () => {
    if (!onSync || isSyncing) return
    setIsSyncing(true)
    try {
      await onSync()
    } finally {
      setIsSyncing(false)
    }
  }

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      conv.contact?.name?.toLowerCase().includes(searchLower) ||
      conv.contact?.phone?.includes(searchQuery)
    )
  })

  return (
    <div className="flex flex-col h-full border-r bg-background overflow-hidden w-[350px]">
      {/* Header */}
      <div className="shrink-0 p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Atribuidas a voce</h2>
          </div>
          <div className="flex items-center gap-2">
            {onSync && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSync}
                disabled={isSyncing}
                title="Sincronizar atribuicoes do Chatwoot"
                className="h-8 w-8"
              >
                <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
              </Button>
            )}
            <Badge variant="secondary">
              {totalCount}
            </Badge>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {searchQuery
                  ? 'Nenhuma conversa encontrada'
                  : 'Nenhuma conversa atribuida a voce'}
              </p>
              {!searchQuery && (
                <p className="text-xs mt-1 opacity-70">
                  Conversas atribuidas aparecerao aqui
                </p>
              )}
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <AssignedConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedId === conversation.id}
                onClick={() => onSelect(conversation)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

type AssignedConversationItemProps = {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
}

function AssignedConversationItem({ conversation, isSelected, onClick }: AssignedConversationItemProps) {
  const contact = conversation.contact
  const initials = contact?.name
    ? contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left",
        isSelected && "bg-muted"
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="h-12 w-12">
          <AvatarImage src={contact?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium truncate">
            {contact?.name || 'Sem nome'}
          </span>
          <span className="text-xs text-muted-foreground shrink-0 ml-2">
            {formatMessageTime(new Date(conversation.last_activity_at))}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground truncate pr-2">
            {conversation.last_message
              ? conversation.last_message.length > 40
                ? conversation.last_message.slice(0, 40) + '...'
                : conversation.last_message
              : 'Sem mensagens'}
          </p>
          {conversation.unread_count != null && conversation.unread_count > 0 && (
            <Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shrink-0">
              {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
            </Badge>
          )}
        </div>

        {conversation.stage && (
          <Badge
            variant="secondary"
            className="mt-1 text-xs"
            style={{
              backgroundColor: conversation.stage.color + '20',
              color: conversation.stage.color
            }}
          >
            {conversation.stage.name}
          </Badge>
        )}
      </div>
    </button>
  )
}
