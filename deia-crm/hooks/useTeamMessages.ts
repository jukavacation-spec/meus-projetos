'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export type TeamMessage = {
  id: string
  company_id: string
  sender_id: string
  receiver_id: string
  content: string
  read_at: string | null
  deleted_by_sender: boolean
  created_at: string
  sender?: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  }
  receiver?: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  }
}

export type Conversation = {
  user_id: string
  user: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  }
  last_message: TeamMessage | null
  unread_count: number
}

export function useTeamMessages() {
  const { user, company } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<TeamMessage[]>([])
  const [totalUnread, setTotalUnread] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    if (!user || !company) return

    const supabase = createClient()

    try {
      // Get all messages involving this user
      const { data: messagesData, error: msgError } = await supabase
        .from('team_messages')
        .select(`
          *,
          sender:users!sender_id(id, name, email, avatar_url),
          receiver:users!receiver_id(id, name, email, avatar_url)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })

      if (msgError) throw msgError

      // Filter out deleted messages for sender
      const filteredMessages = messagesData?.filter(m => {
        if (m.sender_id === user.id && m.deleted_by_sender) return false
        return true
      }) || []

      // Group by conversation partner
      const conversationMap = new Map<string, Conversation>()

      filteredMessages.forEach(msg => {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id
        const partner = msg.sender_id === user.id ? msg.receiver : msg.sender

        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            user_id: partnerId,
            user: partner,
            last_message: msg,
            unread_count: 0,
          })
        }

        // Count unread (messages received that haven't been read)
        if (msg.receiver_id === user.id && !msg.read_at) {
          const conv = conversationMap.get(partnerId)!
          conv.unread_count++
        }
      })

      const convList = Array.from(conversationMap.values())
        .sort((a, b) => {
          if (!a.last_message) return 1
          if (!b.last_message) return -1
          return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
        })

      setConversations(convList)
      setTotalUnread(convList.reduce((sum, c) => sum + c.unread_count, 0))
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [user, company])

  // Fetch messages for a specific conversation
  const fetchMessages = useCallback(async (partnerId: string) => {
    if (!user || !company) return

    setIsLoadingMessages(true)
    setActiveConversation(partnerId)

    const supabase = createClient()

    try {
      const { data, error: fetchError } = await supabase
        .from('team_messages')
        .select(`
          *,
          sender:users!sender_id(id, name, email, avatar_url),
          receiver:users!receiver_id(id, name, email, avatar_url)
        `)
        .eq('company_id', company.id)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })
        .limit(100)

      if (fetchError) throw fetchError

      // Filter out deleted messages for sender
      const filteredMessages = data?.filter(m => {
        if (m.sender_id === user.id && m.deleted_by_sender) return false
        return true
      }) || []

      setMessages(filteredMessages)

      // Mark received messages as read
      const unreadIds = filteredMessages
        .filter(m => m.receiver_id === user.id && !m.read_at)
        .map(m => m.id)

      if (unreadIds.length > 0) {
        await supabase
          .from('team_messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadIds)

        // Update conversations unread count
        setConversations(prev =>
          prev.map(c =>
            c.user_id === partnerId ? { ...c, unread_count: 0 } : c
          )
        )
        setTotalUnread(prev => Math.max(0, prev - unreadIds.length))
      }
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoadingMessages(false)
    }
  }, [user, company])

  // Send message
  const sendMessage = useCallback(async (receiverId: string, content: string) => {
    if (!user || !company) return null

    const supabase = createClient()

    try {
      const { data, error: insertError } = await supabase
        .from('team_messages')
        .insert({
          company_id: company.id,
          sender_id: user.id,
          receiver_id: receiverId,
          content,
        })
        .select(`
          *,
          sender:users!sender_id(id, name, email, avatar_url),
          receiver:users!receiver_id(id, name, email, avatar_url)
        `)
        .single()

      if (insertError) throw insertError

      // Add to messages if viewing this conversation
      if (activeConversation === receiverId) {
        setMessages(prev => [...prev, data])
      }

      // Update conversations
      setConversations(prev => {
        const existing = prev.find(c => c.user_id === receiverId)
        if (existing) {
          return prev.map(c =>
            c.user_id === receiverId
              ? { ...c, last_message: data }
              : c
          ).sort((a, b) => {
            if (!a.last_message) return 1
            if (!b.last_message) return -1
            return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
          })
        }
        // New conversation
        return [{
          user_id: receiverId,
          user: data.receiver,
          last_message: data,
          unread_count: 0,
        }, ...prev]
      })

      return data
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }, [user, company, activeConversation])

  // Delete message (soft delete for sender)
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user) return

    const supabase = createClient()

    try {
      const { error: updateError } = await supabase
        .from('team_messages')
        .update({ deleted_by_sender: true })
        .eq('id', messageId)
        .eq('sender_id', user.id)

      if (updateError) throw updateError

      setMessages(prev => prev.filter(m => m.id !== messageId))
    } catch (err) {
      setError(err as Error)
    }
  }, [user])

  // Mark messages as read
  const markAsRead = useCallback(async (partnerId: string) => {
    if (!user) return

    const supabase = createClient()

    try {
      const { error: updateError } = await supabase
        .from('team_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('receiver_id', user.id)
        .eq('sender_id', partnerId)
        .is('read_at', null)

      if (updateError) throw updateError

      // Update messages
      setMessages(prev =>
        prev.map(m =>
          m.receiver_id === user.id && !m.read_at
            ? { ...m, read_at: new Date().toISOString() }
            : m
        )
      )

      // Update conversation unread count
      const conv = conversations.find(c => c.user_id === partnerId)
      if (conv) {
        setTotalUnread(prev => Math.max(0, prev - conv.unread_count))
        setConversations(prev =>
          prev.map(c =>
            c.user_id === partnerId ? { ...c, unread_count: 0 } : c
          )
        )
      }
    } catch {
    }
  }, [user, conversations])

  // Setup realtime subscription
  useEffect(() => {
    if (!user || !company) return

    fetchConversations()

    const supabase = createClient()

    const channel = supabase
      .channel(`messages-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const newMessage = payload.new as TeamMessage

          // Fetch with user data
          const { data } = await supabase
            .from('team_messages')
            .select(`
              *,
              sender:users!sender_id(id, name, email, avatar_url),
              receiver:users!receiver_id(id, name, email, avatar_url)
            `)
            .eq('id', newMessage.id)
            .single()

          if (data) {
            // If viewing this conversation, add message and mark as read
            if (activeConversation === data.sender_id) {
              setMessages(prev => [...prev, data])
              markAsRead(data.sender_id)
            } else {
              // Update unread count
              setTotalUnread(prev => prev + 1)
            }

            // Update conversations
            setConversations(prev => {
              const existing = prev.find(c => c.user_id === data.sender_id)
              if (existing) {
                return prev.map(c =>
                  c.user_id === data.sender_id
                    ? {
                        ...c,
                        last_message: data,
                        unread_count: activeConversation === data.sender_id
                          ? 0
                          : c.unread_count + 1,
                      }
                    : c
                ).sort((a, b) => {
                  if (!a.last_message) return 1
                  if (!b.last_message) return -1
                  return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
                })
              }
              // New conversation
              return [{
                user_id: data.sender_id,
                user: data.sender,
                last_message: data,
                unread_count: activeConversation === data.sender_id ? 0 : 1,
              }, ...prev]
            })

            // Play notification sound
            const audio = new Audio('/sounds/message.mp3')
            audio.volume = 0.3
            audio.play().catch(() => {})
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'team_messages',
          filter: `sender_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as TeamMessage
          // Update read status
          setMessages(prev =>
            prev.map(m => m.id === updated.id ? { ...m, ...updated } : m)
          )
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, company, activeConversation, fetchConversations, markAsRead])

  // Close conversation
  const closeConversation = useCallback(() => {
    setActiveConversation(null)
    setMessages([])
  }, [])

  return {
    conversations,
    messages,
    activeConversation,
    totalUnread,
    isLoading,
    isLoadingMessages,
    error,
    fetchMessages,
    sendMessage,
    deleteMessage,
    markAsRead,
    closeConversation,
    refetch: fetchConversations,
  }
}

// Format message time
export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Ontem'
  }

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
