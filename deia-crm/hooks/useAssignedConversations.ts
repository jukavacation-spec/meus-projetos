'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'

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
  chatwoot_conversation_id?: number
  chatwoot_inbox_id?: number
  last_message?: string | null
  unread_count?: number
  contact?: Contact
  stage?: Stage
}

export function useAssignedConversations() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [initialized, setInitialized] = useState(false)

  const fetchConversations = useCallback(async () => {
    if (!user) return

    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          contact:contacts(*),
          stage:kanban_stages(*)
        `)
        .eq('assigned_to', user.id)
        .eq('status', 'open')
        .order('last_activity_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setConversations((data || []) as Conversation[])
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // Buscar conversa individual com relations (para updates incrementais)
  const fetchSingleConversation = useCallback(async (id: string): Promise<Conversation | null> => {
    const supabase = createClient()
    const { data } = await supabase
      .from('conversations')
      .select(`*, contact:contacts(*), stage:kanban_stages(*)`)
      .eq('id', id)
      .single()
    return data as Conversation | null
  }, [])

  // Sincronizar atribuições do Chatwoot
  const syncAssignments = useCallback(async () => {
    try {
      const response = await fetch('/api/chatwoot/sync-assignments', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Falha ao sincronizar')
      }

      // Recarregar conversas após sync
      await fetchConversations()
      return true
    } catch (err) {
      console.error('Erro ao sincronizar atribuições:', err)
      return false
    }
  }, [fetchConversations])

  // Marcar conversa como lida
  const markAsRead = useCallback(async (conversationId: string, chatwootConversationId?: number) => {
    // Atualização otimista
    setConversations(prev =>
      prev.map(conv =>
        conv.id === conversationId
          ? { ...conv, unread_count: 0 }
          : conv
      )
    )

    // Chama a API do Chatwoot para marcar como lido
    if (chatwootConversationId) {
      try {
        await fetch(`/api/chatwoot/conversations/${chatwootConversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'markAsRead' })
        })
      } catch {
        // Não reverte o estado local
      }
    }

    // Atualiza no banco local
    const supabase = createClient()
    await supabase
      .from('conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId)
  }, [])

  useEffect(() => {
    if (!user || initialized) return

    const supabase = createClient()

    // Buscar conversas iniciais
    fetchConversations()
    setInitialized(true)

    // Realtime subscription filtrada por assigned_to
    const channel = supabase
      .channel('assigned-conversations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Se a conversa foi atribuída a mim
            if (payload.new.assigned_to === user.id && payload.new.status === 'open') {
              const newConv = await fetchSingleConversation(payload.new.id as string)
              if (newConv) {
                setConversations(prev => [newConv, ...prev].slice(0, 100))
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const wasAssignedToMe = (payload.old as Conversation).assigned_to === user.id
            const isAssignedToMe = payload.new.assigned_to === user.id
            const isOpen = payload.new.status === 'open'

            if (isAssignedToMe && isOpen) {
              // Atualizar ou adicionar
              const updatedConv = await fetchSingleConversation(payload.new.id as string)
              if (updatedConv) {
                if (wasAssignedToMe) {
                  // Atualizar existente
                  setConversations(prev =>
                    prev.map(c => c.id === updatedConv.id ? updatedConv : c)
                  )
                } else {
                  // Adicionar nova (foi atribuída a mim agora)
                  setConversations(prev => [updatedConv, ...prev].slice(0, 100))
                }
              }
            } else if (wasAssignedToMe && (!isAssignedToMe || !isOpen)) {
              // Remover da lista (desatribuída ou resolvida)
              setConversations(prev => prev.filter(c => c.id !== (payload.new as Conversation).id))
            }
          } else if (payload.eventType === 'DELETE') {
            setConversations(prev => prev.filter(c => c.id !== (payload.old as { id: string }).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, initialized, fetchConversations, fetchSingleConversation])

  // Refetch quando a janela ganha foco (volta para a aba)
  // Garante que o contador esteja sempre atualizado
  useEffect(() => {
    if (!user) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchConversations()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user, fetchConversations])

  // Contador de não lidas
  const unreadCount = conversations.reduce((acc, conv) => acc + (conv.unread_count || 0), 0)

  // Total de conversas atribuídas
  const totalCount = conversations.length

  return {
    conversations,
    isLoading,
    error,
    refetch: fetchConversations,
    markAsRead,
    syncAssignments,
    unreadCount,
    totalCount
  }
}
