'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { Message } from '@/components/chat/ChatArea'

export function useMessages(chatwootConversationId: number | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const fetchMessages = useCallback(async () => {
    if (!chatwootConversationId) {
      setMessages([])
      return
    }

    try {
      const response = await fetch(
        `/api/chatwoot/messages?conversationId=${chatwootConversationId}`
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch messages')
      }

      setMessages(data.messages || [])
    } catch (err) {
      setError(err as Error)
    }
  }, [chatwootConversationId])

  const sendMessage = useCallback(async (content: string, isPrivate: boolean = false) => {
    if (!chatwootConversationId || !content.trim()) return

    setIsSending(true)
    try {
      // Optimistic update - add message immediately
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        content,
        message_type: 'outgoing',
        created_at: new Date().toISOString(),
        status: 'sent',
        private: isPrivate
      }
      setMessages(prev => [...prev, optimisticMessage])

      // Envia via Chatwoot (que encaminha para o WhatsApp via UAZAPI webhook)
      const response = await fetch('/api/chatwoot/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: chatwootConversationId,
          content,
          isPrivate
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id))
        throw new Error(data.error || 'Failed to send message')
      }

      // Replace optimistic message with real one
      setMessages(prev =>
        prev.map(m => m.id === optimisticMessage.id ? data.message : m)
      )
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setIsSending(false)
    }
  }, [chatwootConversationId])

  const sendFile = useCallback(async (file: File, content?: string) => {
    if (!chatwootConversationId) return

    setIsSending(true)
    try {
      // Optimistic update - add message with pending status
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        content: content || '',
        message_type: 'outgoing',
        created_at: new Date().toISOString(),
        status: 'sent',
        attachments: [{
          id: 0,
          file_type: file.type.startsWith('image/') ? 'image' :
                     file.type.startsWith('video/') ? 'video' :
                     file.type.startsWith('audio/') ? 'audio' : 'file',
          data_url: URL.createObjectURL(file),
          file_size: file.size,
          extension: file.name.split('.').pop() || null
        }]
      }
      setMessages(prev => [...prev, optimisticMessage])

      const formData = new FormData()
      formData.append('conversationId', String(chatwootConversationId))
      formData.append('content', content || '')
      formData.append('file', file)

      const response = await fetch('/api/chatwoot/messages/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id))
        throw new Error(data.error || 'Failed to upload file')
      }

      // Replace optimistic message with real one
      setMessages(prev =>
        prev.map(m => m.id === optimisticMessage.id ? data.message : m)
      )
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setIsSending(false)
    }
  }, [chatwootConversationId])

  // Initial fetch
  useEffect(() => {
    if (chatwootConversationId) {
      setIsLoading(true)
      fetchMessages().finally(() => setIsLoading(false))
    } else {
      setMessages([])
      setIsLoading(false)
    }
  }, [chatwootConversationId, fetchMessages])

  // Polling for new messages (every 3 seconds para tempo real)
  useEffect(() => {
    if (!chatwootConversationId) return

    pollingRef.current = setInterval(() => {
      fetchMessages()
    }, 3000) // 3s para sensação de tempo real

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [chatwootConversationId, fetchMessages])

  return {
    messages,
    isLoading,
    isSending,
    error,
    sendMessage,
    sendFile,
    refetch: fetchMessages
  }
}
