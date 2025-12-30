'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Search,
  RefreshCw,
  MessageCircle,
  Mail,
  Globe,
  Send,
  Smartphone,
  Facebook,
  Twitter,
  Code,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  X,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Inbox } from '@/hooks/useInboxes'

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

type ConversationListProps = {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (conversation: Conversation) => void
  onSync: () => Promise<void>
  isSyncing: boolean
  inboxes?: Inbox[]
  // Multi-inbox selection props
  selectedInboxIds?: number[]
  onInboxToggle?: (inboxId: number, checked: boolean) => void
  onClearInboxSelection?: () => void
  // Multi-inbox mode props
  currentInboxId?: number
  showInboxHeader?: boolean
  compact?: boolean // For multi-inbox mode - minimal UI
  collapsed?: boolean
  onToggleCollapse?: () => void
}

// Helper function to get channel icon
function ChannelIcon({ channelType, className }: { channelType?: string; className?: string }) {
  const iconClass = cn("h-3.5 w-3.5", className)

  switch (channelType) {
    case 'Channel::Whatsapp':
      return <MessageCircle className={cn(iconClass, "text-green-500")} />
    case 'Channel::Email':
      return <Mail className={cn(iconClass, "text-blue-500")} />
    case 'Channel::WebWidget':
      return <Globe className={cn(iconClass, "text-purple-500")} />
    case 'Channel::Telegram':
      return <Send className={cn(iconClass, "text-sky-500")} />
    case 'Channel::TwilioSms':
    case 'Channel::Sms':
      return <Smartphone className={cn(iconClass, "text-orange-500")} />
    case 'Channel::FacebookPage':
      return <Facebook className={cn(iconClass, "text-blue-600")} />
    case 'Channel::TwitterProfile':
      return <Twitter className={cn(iconClass, "text-sky-400")} />
    case 'Channel::Api':
      return <Code className={cn(iconClass, "text-gray-500")} />
    default:
      return <MessageCircle className={cn(iconClass, "text-gray-400")} />
  }
}

// Helper function to format message time
// Hoje → HH:mm | Ontem → "ontem" | 2+ dias → DD/MM
function formatMessageTime(date: Date): string {
  const now = new Date()

  // Usar toLocaleDateString para comparação segura de timezone
  // Isso garante que ambas as datas usem o mesmo fuso horário do navegador
  const todayStr = now.toLocaleDateString('pt-BR')
  const messageDateStr = date.toLocaleDateString('pt-BR')

  // Hoje - comparar string da data local
  if (todayStr === messageDateStr) {
    return format(date, 'HH:mm', { locale: ptBR })
  }

  // Ontem - criar data de ontem e comparar
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toLocaleDateString('pt-BR')

  if (yesterdayStr === messageDateStr) {
    return 'ontem'
  }

  // 2+ dias atrás - mostrar data DD/MM
  return format(date, 'dd/MM', { locale: ptBR })
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onSync,
  isSyncing,
  inboxes = [],
  selectedInboxIds = [],
  onInboxToggle,
  onClearInboxSelection,
  currentInboxId,
  compact = false,
  collapsed = false,
  onToggleCollapse
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Check if in multi-inbox mode (showing a specific inbox's list)
  const isMultiInboxMode = currentInboxId !== undefined

  // Get current inbox info for multi-inbox mode header
  const currentInbox = isMultiInboxMode ? inboxes.find(i => i.id === currentInboxId) : null

  // Filter by search and inbox
  const filteredConversations = conversations.filter((conv) => {
    // In multi-inbox mode, conversations are pre-filtered by parent
    // In normal mode with inbox filter, apply filter
    if (!isMultiInboxMode && selectedInboxIds.length === 1 && conv.chatwoot_inbox_id !== selectedInboxIds[0]) {
      return false
    }

    // Filter by search
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      conv.contact?.name?.toLowerCase().includes(searchLower) ||
      conv.contact?.phone?.includes(searchQuery)
    )
  })

  // Get inbox info for a conversation
  const getInboxInfo = (inboxId?: number | null) => {
    if (!inboxId) return null
    return inboxes.find(i => i.id === inboxId)
  }

  // Collapsed view - only avatars
  if (collapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <div className="flex flex-col h-full border-r bg-background overflow-hidden w-[68px] transition-all duration-300 ease-in-out">
          {/* Header */}
          <div className="shrink-0 p-2 border-b flex flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleCollapse}
                  className="h-8 w-8"
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expandir</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onSync}
                  disabled={isSyncing}
                  className="h-8 w-8"
                >
                  <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sincronizar</TooltipContent>
            </Tooltip>
          </div>

          {/* Collapsed Conversation List - Avatars only */}
          <div className="flex-1 overflow-y-auto py-2">
            <div className="flex flex-col items-center gap-1">
              {filteredConversations.length === 0 ? (
                <div className="p-2 text-center text-muted-foreground">
                  <MessageCircle className="h-5 w-5 mx-auto opacity-50" />
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <CollapsedConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={selectedId === conversation.id}
                    onClick={() => onSelect(conversation)}
                    inbox={getInboxInfo(conversation.chatwoot_inbox_id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </TooltipProvider>
    )
  }

  // Compact mode for multi-inbox view
  if (compact) {
    return (
      <div className="flex flex-col h-full bg-background overflow-hidden w-full">
        {/* Compact Header */}
        <div className="shrink-0 px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            {currentInbox && (
              <>
                <ChannelIcon channelType={currentInbox.channel_type} className="h-4 w-4" />
                <span className="font-medium text-sm truncate flex-1">{currentInbox.name}</span>
                <Badge variant="outline" className="text-xs shrink-0">
                  {filteredConversations.length}
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* Compact Search */}
        <div className="shrink-0 p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Compact Conversation List */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y">
            {filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-xs">
                Nenhuma conversa
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <CompactConversationItem
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

  // Expanded view - full details
  return (
    <div className="flex flex-col h-full border-r bg-background overflow-hidden w-[350px] transition-all duration-300 ease-in-out">
      {/* Header */}
      <div className="shrink-0 p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Conversas</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onSync}
              disabled={isSyncing}
              title="Sincronizar com Chatwoot"
              className="h-8 w-8"
            >
              <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            </Button>
            {onToggleCollapse && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                title="Recolher sidebar"
                className="h-8 w-8"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Inbox Filter - Multi-select with Checkboxes */}
        {inboxes.length > 0 && onInboxToggle && !isMultiInboxMode && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between h-10"
              >
                <span className="flex items-center gap-2 truncate">
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  {selectedInboxIds.length === 0
                    ? 'Todas as inboxes'
                    : selectedInboxIds.length === 1
                    ? inboxes.find(i => i.id === selectedInboxIds[0])?.name || 'Inbox selecionada'
                    : `${selectedInboxIds.length} inboxes selecionadas`}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <div className="p-2 border-b">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Selecionar Inboxes</span>
                  {selectedInboxIds.length > 0 && onClearInboxSelection && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClearInboxSelection}
                      className="h-7 px-2 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Selecione 2+ para comparar lado a lado
                </p>
              </div>
              <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                {inboxes.map((inbox) => (
                  <label
                    key={inbox.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedInboxIds.includes(inbox.id)}
                      onCheckedChange={(checked) => onInboxToggle(inbox.id, checked === true)}
                    />
                    <ChannelIcon channelType={inbox.channel_type} />
                    <span className="text-sm truncate flex-1">{inbox.name}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

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
            <div className="p-4 text-center text-muted-foreground text-sm">
              {searchQuery || selectedInboxIds.length > 0 || isMultiInboxMode ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedId === conversation.id}
                onClick={() => onSelect(conversation)}
                inbox={getInboxInfo(conversation.chatwoot_inbox_id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

type ConversationItemProps = {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  inbox?: Inbox | null
}

function ConversationItem({ conversation, isSelected, onClick, inbox }: ConversationItemProps) {
  const contact = conversation.contact
  const initials = contact?.name
    ? contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  // Show inbox info - either from loaded inbox or fallback to inbox_id
  const hasInboxId = conversation.chatwoot_inbox_id != null
  const inboxName = inbox?.name || (hasInboxId ? `Inbox #${conversation.chatwoot_inbox_id}` : null)
  const channelType = inbox?.channel_type

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
        {/* Channel icon badge on avatar */}
        {(inbox || hasInboxId) && (
          <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 border shadow-sm">
            <ChannelIcon channelType={channelType} />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">
              {contact?.name || 'Sem nome'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0 ml-2">
            {formatMessageTime(new Date(conversation.last_activity_at))}
          </span>
        </div>

        {/* Inbox badge - show below name for better visibility */}
        {inboxName && (
          <div className="flex items-center gap-1 mb-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1">
              <ChannelIcon channelType={channelType} className="h-2.5 w-2.5" />
              {inboxName}
            </Badge>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground truncate pr-2">
            {conversation.last_message
              ? conversation.last_message.length > 40
                ? conversation.last_message.slice(0, 40) + '...'
                : conversation.last_message
              : 'Sem mensagens'}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {conversation.unread_count != null && conversation.unread_count > 0 && (
              <Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </Badge>
            )}
          </div>
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

// Collapsed conversation item - shows only avatar with tooltip
function CollapsedConversationItem({ conversation, isSelected, onClick, inbox }: ConversationItemProps) {
  const contact = conversation.contact
  const initials = contact?.name
    ? contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const hasInboxId = conversation.chatwoot_inbox_id != null
  const channelType = inbox?.channel_type

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "relative p-1.5 rounded-lg hover:bg-muted/50 transition-colors",
            isSelected && "bg-muted ring-2 ring-primary"
          )}
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={contact?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          {/* Channel icon badge */}
          {(inbox || hasInboxId) && (
            <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5 border shadow-sm">
              <ChannelIcon channelType={channelType} className="h-3 w-3" />
            </div>
          )}
          {/* Unread badge */}
          {conversation.unread_count != null && conversation.unread_count > 0 && (
            <div className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[10px] font-medium">
              {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
            </div>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[200px]">
        <div className="space-y-1">
          <p className="font-medium">{contact?.name || 'Sem nome'}</p>
          {inbox && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ChannelIcon channelType={inbox.channel_type} className="h-3 w-3" />
              {inbox.name}
            </p>
          )}
          {conversation.last_message && (
            <p className="text-xs text-muted-foreground truncate">
              {conversation.last_message}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

// Compact conversation item for multi-inbox view - minimalist design
type CompactConversationItemProps = {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
}

function CompactConversationItem({ conversation, isSelected, onClick }: CompactConversationItemProps) {
  const contact = conversation.contact
  const initials = contact?.name
    ? contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-muted/50 transition-colors text-left",
        isSelected && "bg-muted"
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="h-9 w-9">
          <AvatarImage src={contact?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        {conversation.unread_count != null && conversation.unread_count > 0 && (
          <div className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[10px] font-medium">
            {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">
            {contact?.name || 'Sem nome'}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
            {formatMessageTime(new Date(conversation.last_activity_at))}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {conversation.last_message
            ? conversation.last_message.length > 30
              ? conversation.last_message.slice(0, 30) + '...'
              : conversation.last_message
            : 'Sem mensagens'}
        </p>
      </div>
    </button>
  )
}
