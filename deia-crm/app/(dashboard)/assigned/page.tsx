'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useAssignedConversations } from '@/hooks/useAssignedConversations'
import { useMessages } from '@/hooks/useMessages'
import { ChatArea, ContactDetails } from '@/components/chat'
import { AssignedConversationList } from '@/components/chat/AssignedConversationList'

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

export default function AssignedPage() {
  const { conversations, isLoading, markAsRead, syncAssignments, totalCount } = useAssignedConversations()
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [showDetails, setShowDetails] = useState(true)

  const chatwootConversationId = selectedConversation?.chatwoot_conversation_id || null
  const { messages, isLoading: messagesLoading, isSending, sendMessage, sendFile } = useMessages(chatwootConversationId)

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation)

    // Marcar como lida se tiver mensagens não lidas
    if (conversation.unread_count && conversation.unread_count > 0) {
      markAsRead(conversation.id, conversation.chatwoot_conversation_id || undefined)
    }
  }

  const handleSendMessage = async (content: string, isPrivate?: boolean) => {
    await sendMessage(content, isPrivate)
  }

  const handleSendFile = async (file: File, content?: string) => {
    await sendFile(file, content)
  }

  const handleStatusChange = (conversationId: string, newStatus: string) => {
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
          Carregando conversas atribuidas...
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Column - Assigned Conversation List */}
      <div className="shrink-0 h-full">
        <AssignedConversationList
          conversations={conversations as Conversation[]}
          selectedId={selectedConversation?.id || null}
          onSelect={handleSelectConversation}
          totalCount={totalCount}
          onSync={syncAssignments}
        />
      </div>

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
