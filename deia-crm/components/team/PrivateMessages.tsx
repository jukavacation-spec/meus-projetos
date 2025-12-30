'use client'

import { useState, useRef, useEffect } from 'react'
import {
  ArrowLeft,
  MessageSquare,
  Send,
  Trash2,
  X,
  Loader2,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useTeamMessages, formatMessageTime } from '@/hooks/useTeamMessages'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

type PrivateMessagesProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialUserId?: string
  initialUserName?: string
}

export function PrivateMessages({
  open,
  onOpenChange,
  initialUserId,
  initialUserName,
}: PrivateMessagesProps) {
  const { user } = useAuth()
  const {
    conversations,
    messages,
    activeConversation,
    isLoading,
    isLoadingMessages,
    fetchMessages,
    sendMessage,
    deleteMessage,
    closeConversation,
  } = useTeamMessages()

  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Open initial conversation if provided
  useEffect(() => {
    if (open && initialUserId && !activeConversation) {
      fetchMessages(initialUserId)
    }
  }, [open, initialUserId, activeConversation, fetchMessages])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!messageText.trim() || !activeConversation) return

    setIsSending(true)
    try {
      await sendMessage(activeConversation, messageText.trim())
      setMessageText('')
    } catch {
      // Error handled in hook
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClose = () => {
    closeConversation()
    onOpenChange(false)
  }

  const handleBack = () => {
    closeConversation()
  }

  // Get current conversation partner info
  const currentPartner = activeConversation
    ? conversations.find(c => c.user_id === activeConversation)?.user ||
      (initialUserId === activeConversation
        ? { id: initialUserId, name: initialUserName, email: '', avatar_url: null }
        : null)
    : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center gap-3">
            {activeConversation ? (
              <>
                <Button variant="ghost" size="icon" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={currentPartner?.avatar_url || undefined} />
                  <AvatarFallback>
                    {currentPartner?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <SheetTitle className="flex-1">
                  {currentPartner?.name || 'Usuario'}
                </SheetTitle>
              </>
            ) : (
              <>
                <SheetTitle className="flex-1">Mensagens</SheetTitle>
                <Button variant="ghost" size="icon" onClick={handleClose}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeConversation ? (
            // Chat view
            <div className="flex flex-col h-full">
              <ScrollArea className="flex-1 p-4">
                {isLoadingMessages ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className={cn('flex', i % 2 === 0 && 'justify-end')}>
                        <Skeleton className="h-12 w-48 rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma mensagem ainda</p>
                    <p className="text-sm">Envie uma mensagem para iniciar</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isMine = msg.sender_id === user?.id

                      return (
                        <div
                          key={msg.id}
                          className={cn('flex gap-2', isMine && 'justify-end')}
                        >
                          {!isMine && (
                            <Avatar className="h-6 w-6 shrink-0">
                              <AvatarImage src={msg.sender?.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {msg.sender?.name?.charAt(0)?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div
                            className={cn(
                              'group relative max-w-[80%] px-3 py-2 rounded-lg',
                              isMine
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <span
                                className={cn(
                                  'text-xs',
                                  isMine
                                    ? 'text-primary-foreground/70'
                                    : 'text-muted-foreground'
                                )}
                              >
                                {formatMessageTime(msg.created_at)}
                              </span>
                              {isMine && msg.read_at && (
                                <span className="text-xs text-primary-foreground/70">
                                  - Lido
                                </span>
                              )}
                            </div>
                            {isMine && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute -right-8 top-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => deleteMessage(msg.id)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Digite sua mensagem..."
                    disabled={isSending}
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!messageText.trim() || isSending}
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Conversations list
            <ScrollArea className="h-full">
              {isLoading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma conversa ainda</p>
                  <p className="text-sm mt-1">
                    Clique em um membro da equipe para enviar uma mensagem
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {conversations.map((conv) => (
                    <button
                      key={conv.user_id}
                      onClick={() => fetchMessages(conv.user_id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg transition-colors',
                        'hover:bg-muted/50 text-left'
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={conv.user.avatar_url || undefined} />
                        <AvatarFallback>
                          {conv.user.name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {conv.user.name || conv.user.email}
                          </span>
                          {conv.unread_count > 0 && (
                            <Badge className="h-5 min-w-[20px] px-1.5">
                              {conv.unread_count}
                            </Badge>
                          )}
                        </div>
                        {conv.last_message && (
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.last_message.sender_id === user?.id ? 'Voce: ' : ''}
                            {conv.last_message.content}
                          </p>
                        )}
                      </div>
                      {conv.last_message && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatMessageTime(conv.last_message.created_at)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
