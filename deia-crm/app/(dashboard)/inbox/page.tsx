'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useConversations } from '@/hooks/useConversations'
import { useMessages } from '@/hooks/useMessages'
import { useInboxes } from '@/hooks/useInboxes'
import { ConversationList, ChatArea, ContactDetails } from '@/components/chat'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'faldesk-conversation-list-collapsed'

// Helper para ler do localStorage de forma segura (SSR-safe)
function getInitialCollapsedState(): boolean {
  if (typeof window === 'undefined') return false
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'true'
}

type Contact = {
  id: string
  phone: string
  name: string | null
  avatar_url: string | null
  email?: string | null
  created_at?: string
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
  chatwoot_conversation_id?: number | null
  chatwoot_inbox_id?: number | null
  last_message?: string | null
  unread_count?: number
}

export default function InboxPage() {
  const { conversations, isLoading, isSyncing, syncFromChatwoot, markAsRead } = useConversations()
  const { activeInboxes, isInboxActive } = useInboxes()
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [showDetails, setShowDetails] = useState(true)
  const [selectedInboxIds, setSelectedInboxIds] = useState<number[]>([])
  const [conversationListCollapsed, setConversationListCollapsed] = useState(getInitialCollapsedState)

  // Filtrar conversas para mostrar apenas de inboxes ativas
  const filteredConversations = conversations.filter(conv => {
    if (!conv.chatwoot_inbox_id) return true // Mostrar conversas sem inbox definida
    return isInboxActive(conv.chatwoot_inbox_id)
  })

  // Handler para toggle de inbox no multi-select
  const handleInboxToggle = (inboxId: number, checked: boolean) => {
    if (checked) {
      setSelectedInboxIds(prev => [...prev, inboxId])
    } else {
      setSelectedInboxIds(prev => prev.filter(id => id !== inboxId))
    }
  }

  // Limpar seleção de inboxes
  const handleClearInboxSelection = () => {
    setSelectedInboxIds([])
  }

  // Verificar se está em modo multi-inbox (2+ inboxes selecionadas)
  const isMultiInboxMode = selectedInboxIds.length >= 2

  // Toggle collapsed state and persist to localStorage
  const handleToggleCollapse = () => {
    setConversationListCollapsed(prev => {
      const newValue = !prev
      localStorage.setItem(STORAGE_KEY, String(newValue))
      return newValue
    })
  }

  const chatwootConversationId = selectedConversation?.chatwoot_conversation_id || null
  const { messages, isLoading: messagesLoading, isSending, sendMessage, sendFile } = useMessages(chatwootConversationId)

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation)

    // Marcar como lida se tiver mensagens não lidas
    if (conversation.unread_count && conversation.unread_count > 0) {
      markAsRead(conversation.id, conversation.chatwoot_conversation_id || undefined)
    }
  }

  const handleSync = async () => {
    await syncFromChatwoot()
  }

  const handleSendMessage = async (content: string, isPrivate?: boolean) => {
    await sendMessage(content, isPrivate)
  }

  const handleSendFile = async (file: File, content?: string) => {
    await sendFile(file, content)
  }

  const handleStatusChange = (conversationId: string, newStatus: string) => {
    // Update the selected conversation's status locally
    if (selectedConversation && selectedConversation.id === conversationId) {
      setSelectedConversation({
        ...selectedConversation,
        status: newStatus
      })
    }
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Carregando conversas...
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Column - Conversation List(s) */}
      {isMultiInboxMode ? (
        // Modo multi-inbox: múltiplas listas lado a lado com design minimalista
        <div className="flex h-full shrink-0">
          {selectedInboxIds.map((inboxId, index) => {
            const inboxConversations = filteredConversations.filter(c => c.chatwoot_inbox_id === inboxId)
            return (
              <div
                key={inboxId}
                className={cn(
                  "w-[260px] shrink-0 h-full flex flex-col bg-background",
                  index < selectedInboxIds.length - 1 && "border-r"
                )}
              >
                <ConversationList
                  conversations={inboxConversations}
                  selectedId={selectedConversation?.id || null}
                  onSelect={handleSelectConversation}
                  onSync={handleSync}
                  isSyncing={isSyncing}
                  inboxes={activeInboxes}
                  selectedInboxIds={selectedInboxIds}
                  onInboxToggle={handleInboxToggle}
                  onClearInboxSelection={handleClearInboxSelection}
                  currentInboxId={inboxId}
                  compact={true}
                />
              </div>
            )
          })}
          {/* Botão para voltar ao modo normal */}
          <div className="w-10 shrink-0 border-r flex flex-col items-center py-2 bg-muted/30">
            <button
              onClick={handleClearInboxSelection}
              className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Voltar para lista única"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      ) : (
        // Modo normal: lista única
        <div className="shrink-0 h-full">
          <ConversationList
            conversations={filteredConversations}
            selectedId={selectedConversation?.id || null}
            onSelect={handleSelectConversation}
            onSync={handleSync}
            isSyncing={isSyncing}
            inboxes={activeInboxes}
            selectedInboxIds={selectedInboxIds}
            onInboxToggle={handleInboxToggle}
            onClearInboxSelection={handleClearInboxSelection}
            collapsed={conversationListCollapsed}
            onToggleCollapse={handleToggleCollapse}
          />
        </div>
      )}

      {/* Center Column - Chat Area */}
      <ChatArea
        conversation={selectedConversation}
        messages={messages}
        isLoading={messagesLoading}
        onSendMessage={handleSendMessage}
        onSendFile={handleSendFile}
        isSending={isSending}
        showDetails={showDetails}
        onToggleDetails={() => setShowDetails(true)}
        onStatusChange={handleStatusChange}
      />

      {/* Right Column - Contact Details */}
      {showDetails && selectedConversation && (
        <ContactDetails
          conversation={selectedConversation}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  )
}
