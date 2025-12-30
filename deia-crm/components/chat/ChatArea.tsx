'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Send,
  Paperclip,
  MoreVertical,
  Phone,
  Video,
  Check,
  CheckCheck,
  MessageSquare,
  PanelRight,
  Image,
  FileText,
  Music,
  Film,
  Download,
  X,
  Loader2,
  Lock,
  Info,
  CheckCircle2,
  RotateCcw,
  MapPin
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { MediaModal } from './MediaModal'
import { EmojiPickerPopover } from './EmojiPickerPopover'
import { QuickRepliesPopover } from './QuickRepliesPopover'
import { AudioRecorder } from './AudioRecorder'

export type Attachment = {
  id: number
  file_type: 'image' | 'audio' | 'video' | 'file' | 'location'
  data_url: string
  thumb_url?: string | null
  file_size: number
  extension?: string | null
}

export type Message = {
  id: string
  content: string
  message_type: 'incoming' | 'outgoing' | 'activity'
  created_at: string
  status?: 'sent' | 'delivered' | 'read'
  private?: boolean
  content_type?: string
  sender?: {
    name: string
    type: string
  }
  attachments?: Attachment[]
}

type Contact = {
  id: string
  phone: string
  name: string | null
  avatar_url: string | null
}

type Conversation = {
  id: string
  contact?: Contact
  status: string
  chatwoot_conversation_id?: number | null
}

type ChatAreaProps = {
  conversation: Conversation | null
  messages: Message[]
  isLoading: boolean
  onSendMessage: (content: string, isPrivate?: boolean) => Promise<void>
  onSendFile?: (file: File, content?: string) => Promise<void>
  onSendAudio?: (audioBlob: Blob) => Promise<void>
  isSending: boolean
  showDetails?: boolean
  onToggleDetails?: () => void
  onStatusChange?: (conversationId: string, newStatus: string) => void
}

type MediaItem = {
  id: number
  file_type: 'image' | 'audio' | 'video' | 'file' | 'location'
  data_url: string
  thumb_url?: string | null
}

export function ChatArea({
  conversation,
  messages,
  isLoading,
  onSendMessage,
  onSendFile,
  onSendAudio,
  isSending,
  showDetails = true,
  onToggleDetails,
  onStatusChange
}: ChatAreaProps) {
  const [inputValue, setInputValue] = useState('')
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null)
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false)
  const [isPrivateMode, setIsPrivateMode] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastMessageIdRef = useRef<string | null>(null)
  const isUserScrollingRef = useRef(false)

  // Collect all media items from messages for gallery navigation
  const allMediaItems = useMemo(() => {
    const items: MediaItem[] = []
    messages.forEach(message => {
      message.attachments?.forEach(att => {
        if (att.file_type === 'image' || att.file_type === 'video') {
          items.push({
            id: att.id,
            file_type: att.file_type,
            data_url: att.data_url,
            thumb_url: att.thumb_url
          })
        }
      })
    })
    return items
  }, [messages])

  const handleMediaClick = (attachment: Attachment) => {
    setSelectedMedia({
      id: attachment.id,
      file_type: attachment.file_type,
      data_url: attachment.data_url,
      thumb_url: attachment.thumb_url
    })
    setIsMediaModalOpen(true)
  }

  // Check if user is near bottom of the chat
  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return true
    const threshold = 150 // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold
  }, [])

  // Handle scroll events to detect user scrolling
  const handleScroll = useCallback(() => {
    // Mark as user scrolling if they're not near the bottom
    isUserScrollingRef.current = !isNearBottom()
  }, [isNearBottom])

  // Auto-scroll to bottom only when there are NEW messages
  useEffect(() => {
    if (messages.length === 0) {
      lastMessageIdRef.current = null
      return
    }

    const lastMessage = messages[messages.length - 1]
    const hasNewMessage = lastMessage.id !== lastMessageIdRef.current

    // Only scroll if there's a new message AND user is not scrolled up reading history
    if (hasNewMessage) {
      lastMessageIdRef.current = lastMessage.id

      // Always scroll for new conversations or if user is near bottom
      if (!isUserScrollingRef.current || isNearBottom()) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages, isNearBottom])

  // Reset scroll tracking when conversation changes
  useEffect(() => {
    isUserScrollingRef.current = false
    lastMessageIdRef.current = null
    // Scroll to bottom on conversation change
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
    }, 0)
  }, [conversation?.id])

  // Focus input when conversation changes
  useEffect(() => {
    if (conversation && inputRef.current) {
      inputRef.current.focus()
    }
  }, [conversation?.id])

  // Restaurar foco após envio terminar
  useEffect(() => {
    if (!isSending && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isSending])

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFilePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setFilePreview(null)
    }
  }

  // Clear selected file
  const clearSelectedFile = () => {
    setSelectedFile(null)
    setFilePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle status change (resolve/reopen)
  const handleStatusChange = async () => {
    if (!conversation?.chatwoot_conversation_id) return

    setIsChangingStatus(true)
    try {
      const newStatus = conversation.status === 'open' ? 'resolved' : 'open'
      const response = await fetch(`/api/chatwoot/conversations/${conversation.chatwoot_conversation_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', status: newStatus })
      })

      if (!response.ok) {
        throw new Error('Failed to change status')
      }

      // Notify parent to update the conversation status
      onStatusChange?.(conversation.id, newStatus)
    } catch {
      // Error handled silently
    } finally {
      setIsChangingStatus(false)
    }
  }

  const handleSend = () => {
    if (isSending) return

    // Send file if selected (files cannot be private)
    if (selectedFile && onSendFile) {
      const content = inputValue.trim()
      setInputValue('')
      clearSelectedFile()
      setIsPrivateMode(false)
      onSendFile(selectedFile, content || undefined)
      inputRef.current?.focus()
      return
    }

    // Send text message
    if (!inputValue.trim()) return
    const content = inputValue.trim()
    const sendAsPrivate = isPrivateMode
    setInputValue('')
    setIsPrivateMode(false)
    onSendMessage(content, sendAsPrivate)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Get file icon based on type
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <Image className="h-5 w-5" />
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext || '')) return <Film className="h-5 w-5" />
    if (['mp3', 'wav', 'ogg', 'aac'].includes(ext || '')) return <Music className="h-5 w-5" />
    return <FileText className="h-5 w-5" />
  }

  if (!conversation) {
    return (
      <div className="flex-1 min-w-0 flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">
            Selecione uma conversa
          </h3>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Escolha uma conversa na lista ao lado para ver as mensagens
          </p>
        </div>
      </div>
    )
  }

  const contact = conversation.contact
  const initials = contact?.name
    ? contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-[#efeae2] dark:bg-zinc-900">
      {/* Chat Header */}
      <div className="h-16 shrink-0 px-4 flex items-center justify-between bg-background border-b">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={contact?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="font-medium truncate">{contact?.name || 'Sem nome'}</h3>
            <p className="text-xs text-muted-foreground">
              {conversation.status === 'open' ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Resolve/Reopen Button */}
          {conversation.chatwoot_conversation_id && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={conversation.status === 'open' ? 'default' : 'outline'}
                    size="sm"
                    onClick={handleStatusChange}
                    disabled={isChangingStatus}
                    className={cn(
                      "gap-1.5 h-8",
                      conversation.status === 'open'
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950"
                    )}
                  >
                    {isChangingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : conversation.status === 'open' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    <span className="text-xs font-medium">
                      {conversation.status === 'open' ? 'Resolver' : 'Reabrir'}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {conversation.status === 'open'
                    ? 'Marcar conversa como resolvida'
                    : 'Reabrir conversa'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Video className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <MoreVertical className="h-5 w-5" />
          </Button>
          {!showDetails && onToggleDetails && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleDetails}
                    className="text-muted-foreground"
                  >
                    <PanelRight className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Detalhes do contato
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-muted-foreground">
              Carregando mensagens...
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">
              Nenhuma mensagem ainda. Inicie a conversa!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message, index) => {
              // Mensagem de sistema (activity)
              if (message.message_type === 'activity') {
                return (
                  <SystemMessage
                    key={message.id}
                    message={message}
                    showDate={shouldShowDate(messages, index)}
                  />
                )
              }
              // Mensagem privada
              if (message.private) {
                return (
                  <PrivateMessage
                    key={message.id}
                    message={message}
                    showDate={shouldShowDate(messages, index)}
                  />
                )
              }
              // Mensagem normal (incoming/outgoing)
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  showDate={shouldShowDate(messages, index)}
                  onMediaClick={handleMediaClick}
                />
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* File Preview */}
      {selectedFile && (
        <div className="shrink-0 px-3 pt-3 bg-background border-t">
          <div className="flex items-center gap-3 p-2 bg-muted rounded-lg">
            {filePreview ? (
              <img
                src={filePreview}
                alt="Preview"
                className="h-16 w-16 object-cover rounded"
              />
            ) : (
              <div className="h-16 w-16 flex items-center justify-center bg-muted-foreground/10 rounded">
                {getFileIcon(selectedFile.name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearSelectedFile}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className={cn(
        "shrink-0 p-3 bg-background",
        !selectedFile && "border-t",
        isPrivateMode && "bg-yellow-50 dark:bg-yellow-900/20"
      )}>
        {/* Private Mode Indicator */}
        {isPrivateMode && (
          <div className="flex items-center gap-2 mb-2 text-yellow-700 dark:text-yellow-500">
            <Lock className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Nota privada - somente a equipe vera esta mensagem</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs ml-auto"
              onClick={() => setIsPrivateMode(false)}
            >
              Cancelar
            </Button>
          </div>
        )}
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />
        <div className="flex items-center gap-2">
          {/* Private Note Toggle */}
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isPrivateMode ? "default" : "ghost"}
                  size="icon"
                  className={cn(
                    "shrink-0",
                    isPrivateMode
                      ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                      : "text-muted-foreground"
                  )}
                  onClick={() => setIsPrivateMode(!isPrivateMode)}
                  disabled={isSending}
                >
                  <Lock className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isPrivateMode ? "Desativar nota privada" : "Enviar nota privada (so equipe ve)"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Emoji Picker */}
          <EmojiPickerPopover
            onSelect={(emoji) => setInputValue(prev => prev + emoji)}
            disabled={isSending}
          />

          {/* Quick Replies */}
          <QuickRepliesPopover
            onSelect={(content) => {
              setInputValue(content)
              inputRef.current?.focus()
            }}
            inputValue={inputValue}
          />

          {/* File attachment */}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || isPrivateMode}
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          {/* Input */}
          <Input
            ref={inputRef}
            placeholder={
              isPrivateMode
                ? "Digite uma nota privada..."
                : selectedFile
                ? "Adicionar legenda..."
                : "Digite uma mensagem ou /atalho..."
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            className={cn(
              "flex-1 min-w-0",
              isPrivateMode && "border-yellow-300 dark:border-yellow-700 focus-visible:ring-yellow-500"
            )}
          />

          {/* Audio Recorder or Send Button */}
          {!inputValue.trim() && !selectedFile && onSendAudio ? (
            <AudioRecorder
              onSend={onSendAudio}
              disabled={isSending}
            />
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={(!inputValue.trim() && !selectedFile) || isSending}
              className="shrink-0"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Media Modal */}
      <MediaModal
        media={selectedMedia}
        allMedia={allMediaItems}
        open={isMediaModalOpen}
        onOpenChange={setIsMediaModalOpen}
      />
    </div>
  )
}

type MessageBubbleProps = {
  message: Message
  showDate: boolean
  onMediaClick?: (attachment: Attachment) => void
}

function MessageBubble({ message, showDate, onMediaClick }: MessageBubbleProps) {
  const isOutgoing = message.message_type === 'outgoing'
  const time = format(new Date(message.created_at), 'HH:mm', { locale: ptBR })
  const date = format(new Date(message.created_at), "d 'de' MMMM", { locale: ptBR })
  const hasAttachments = message.attachments && message.attachments.length > 0

  // Get agent initials from name
  const getAgentInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <>
      {showDate && (
        <div className="flex justify-center my-4">
          <span className="bg-white dark:bg-zinc-800 text-muted-foreground text-xs px-3 py-1 rounded-full shadow-sm">
            {date}
          </span>
        </div>
      )}
      <div className={cn("flex items-end gap-1.5", isOutgoing ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "max-w-[65%] rounded-lg shadow-sm overflow-hidden",
            isOutgoing
              ? "bg-[#d9fdd3] dark:bg-emerald-900 rounded-br-none"
              : "bg-white dark:bg-zinc-800 rounded-bl-none",
            hasAttachments ? "p-1" : "px-3 py-2"
          )}
        >
          {/* Attachments */}
          {hasAttachments && message.attachments?.map((attachment) => (
            <div key={attachment.id} className="mb-1">
              {attachment.file_type === 'image' && (
                <img
                  src={
                    // Para GIFs, usar data_url direto para manter animação
                    attachment.extension === 'gif' || attachment.data_url?.includes('.gif')
                      ? attachment.data_url
                      : (attachment.thumb_url || attachment.data_url)
                  }
                  alt="Imagem"
                  className="max-w-full rounded cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ maxHeight: '300px' }}
                  onClick={() => onMediaClick?.(attachment)}
                />
              )}

              {attachment.file_type === 'video' && (
                <div
                  className="relative cursor-pointer group"
                  onClick={() => onMediaClick?.(attachment)}
                >
                  <video
                    src={attachment.data_url}
                    className="max-w-full rounded hover:opacity-90 transition-opacity"
                    style={{ maxHeight: '300px' }}
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                  {/* Play icon - aparece em hover para indicar que pode clicar */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/50 rounded-full p-3">
                      <Film className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </div>
              )}

              {attachment.file_type === 'audio' && (
                <div className="p-2">
                  <audio
                    src={attachment.data_url}
                    controls
                    className="w-full min-w-[200px]"
                  />
                </div>
              )}

              {attachment.file_type === 'file' && (
                <a
                  href={attachment.data_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 hover:bg-black/5 rounded transition-colors"
                >
                  <div className="h-10 w-10 flex items-center justify-center bg-primary/10 rounded">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {attachment.extension ? `Arquivo.${attachment.extension}` : 'Arquivo'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.file_size)}
                    </p>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </a>
              )}

              {attachment.file_type === 'location' && (
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span className="text-sm">Localização compartilhada</span>
                  {attachment.data_url && (
                    <a
                      href={`https://www.google.com/maps?q=${encodeURIComponent(attachment.data_url)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-sm underline ml-2"
                    >
                      Ver no mapa
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Text content */}
          {message.content && (
            <div className={hasAttachments ? "px-2 pb-1" : ""}>
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
            </div>
          )}

          {/* Time and status */}
          <div className={cn(
            "flex items-center gap-1 mt-1",
            isOutgoing ? "justify-end" : "justify-start",
            hasAttachments ? "px-2 pb-1" : ""
          )}>
            <span className="text-[10px] text-muted-foreground">{time}</span>
            {isOutgoing && (
              <span className="text-muted-foreground">
                {message.status === 'read' ? (
                  <CheckCheck className="h-3 w-3 text-blue-500" />
                ) : message.status === 'delivered' ? (
                  <CheckCheck className="h-3 w-3" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Agent avatar for outgoing messages */}
        {isOutgoing && message.sender?.name && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 cursor-default">
                  <span className="text-[10px] font-medium text-primary">
                    {getAgentInitials(message.sender.name)}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                {message.sender.name}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </>
  )
}

// Componente para mensagens do sistema (activity)
type SystemMessageProps = {
  message: Message
  showDate: boolean
}

function SystemMessage({ message, showDate }: SystemMessageProps) {
  const date = format(new Date(message.created_at), "d 'de' MMMM", { locale: ptBR })
  const time = format(new Date(message.created_at), 'HH:mm', { locale: ptBR })

  return (
    <>
      {showDate && (
        <div className="flex justify-center my-4">
          <span className="bg-white dark:bg-zinc-800 text-muted-foreground text-xs px-3 py-1 rounded-full shadow-sm">
            {date}
          </span>
        </div>
      )}
      <div className="flex justify-center my-2">
        <div className="flex items-center gap-1.5 bg-muted/80 dark:bg-zinc-800/80 px-3 py-1.5 rounded-full">
          <Info className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {message.content}
          </span>
          <span className="text-[10px] text-muted-foreground/60 ml-1">
            {time}
          </span>
        </div>
      </div>
    </>
  )
}

// Componente para mensagens privadas (notas internas)
type PrivateMessageProps = {
  message: Message
  showDate: boolean
}

function PrivateMessage({ message, showDate }: PrivateMessageProps) {
  const date = format(new Date(message.created_at), "d 'de' MMMM", { locale: ptBR })
  const time = format(new Date(message.created_at), 'HH:mm', { locale: ptBR })

  return (
    <>
      {showDate && (
        <div className="flex justify-center my-4">
          <span className="bg-white dark:bg-zinc-800 text-muted-foreground text-xs px-3 py-1 rounded-full shadow-sm">
            {date}
          </span>
        </div>
      )}
      <div className="flex justify-end mb-2">
        <div className="max-w-[70%] bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-2 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Lock className="h-3 w-3 text-yellow-600 dark:text-yellow-500" />
            <span className="text-xs font-medium text-yellow-700 dark:text-yellow-500">
              Nota privada
            </span>
            {message.sender?.name && (
              <span className="text-xs text-yellow-600/70 dark:text-yellow-500/70">
                - {message.sender.name}
              </span>
            )}
          </div>
          <p className="text-sm text-yellow-900 dark:text-yellow-100 whitespace-pre-wrap break-words">
            {message.content}
          </p>
          <div className="flex justify-end mt-1">
            <span className="text-[10px] text-yellow-600/70 dark:text-yellow-500/70">{time}</span>
          </div>
        </div>
      </div>
    </>
  )
}

function shouldShowDate(messages: Message[], index: number): boolean {
  if (index === 0) return true

  const currentDate = new Date(messages[index].created_at).toDateString()
  const previousDate = new Date(messages[index - 1].created_at).toDateString()

  return currentDate !== previousDate
}
