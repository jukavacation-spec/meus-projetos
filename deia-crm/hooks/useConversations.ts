'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

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

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [allowedInboxIds, setAllowedInboxIds] = useState<number[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [initialized, setInitialized] = useState(false)

  const fetchConversations = useCallback(async (inboxIds?: number[] | null) => {
    const supabase = createClient()
    try {
      let query = supabase
        .from('conversations')
        .select(`
          *,
          contact:contacts(*),
          stage:kanban_stages(*)
        `)
        .order('last_activity_at', { ascending: false })
        .limit(100)

      // Filtrar por inboxes permitidas se houver restrição
      const idsToFilter = inboxIds
      if (idsToFilter && idsToFilter.length > 0) {
        query = query.in('chatwoot_inbox_id', idsToFilter)
      } else if (idsToFilter && idsToFilter.length === 0) {
        // Se a lista está vazia, não mostrar nada
        setConversations([])
        setIsLoading(false)
        return
      }
      // Se idsToFilter é null/undefined, busca todas (para admins)

      const { data: dbConvs, error } = await query

      if (error) throw error

      // Dados vêm do DB via webhooks - sem polling para Chatwoot
      setConversations((dbConvs || []) as Conversation[])
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const syncFromChatwoot = useCallback(async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/chatwoot/sync', { method: 'POST' })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Sync failed')
      }

      // Refetch conversations after sync (usando os IDs permitidos)
      await fetchConversations(allowedInboxIds)
      return result
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setIsSyncing(false)
    }
  }, [fetchConversations, allowedInboxIds])

  // Marcar conversa como lida
  const markAsRead = useCallback(async (conversationId: string, chatwootConversationId?: number) => {
    // Atualização otimista - zera o unread_count imediatamente
    setConversations(prev =>
      prev.map(conv =>
        conv.id === conversationId
          ? { ...conv, unread_count: 0 }
          : conv
      )
    )

    // Chama a API do Chatwoot para marcar como lido (se tiver o ID do Chatwoot)
    if (chatwootConversationId) {
      try {
        await fetch(`/api/chatwoot/conversations/${chatwootConversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'markAsRead' })
        })
      } catch {
        // Não reverte o estado local pois o usuário já viu as mensagens
      }
    }

    // Também atualiza no banco de dados local
    const supabase = createClient()
    await supabase
      .from('conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId)
  }, [])

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

  useEffect(() => {
    if (initialized) return

    const supabase = createClient()
    let currentAllowedIds: number[] | null = null

    // Primeiro buscar inboxes permitidas, depois conversas
    const init = async () => {
      try {
        const response = await fetch('/api/chatwoot/inboxes')
        const data = await response.json()
        if (data.inboxes) {
          currentAllowedIds = data.inboxes.map((i: { id: number }) => i.id)
          setAllowedInboxIds(currentAllowedIds)
        }
      } catch (err) {
        console.error('Error fetching allowed inboxes:', err)
      }
      await fetchConversations(currentAllowedIds)
      setInitialized(true)
    }
    init()

    // Realtime subscription com updates incrementais
    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        async (payload) => {
          console.log('[Realtime] Conversation event:', payload.eventType, payload.new)
          if (payload.eventType === 'INSERT') {
            // Buscar conversa completa com relations
            const newConv = await fetchSingleConversation(payload.new.id as string)
            // Só adiciona se a inbox da conversa for permitida
            if (newConv && (currentAllowedIds === null || (newConv.chatwoot_inbox_id && currentAllowedIds.includes(newConv.chatwoot_inbox_id)))) {
              setConversations(prev => [newConv, ...prev].slice(0, 100))
            }
          } else if (payload.eventType === 'UPDATE') {
            // Buscar conversa atualizada com relations
            const updatedConv = await fetchSingleConversation(payload.new.id as string)
            if (updatedConv) {
              console.log('[Realtime] Updated conversation:', updatedConv.id, 'last_message:', updatedConv.last_message)
              setConversations(prev => {
                // Atualiza e reordena por last_activity_at
                const updated = prev.map(c => c.id === updatedConv.id ? updatedConv : c)
                return updated.sort((a, b) =>
                  new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
                )
              })
            }
          } else if (payload.eventType === 'DELETE') {
            setConversations(prev => prev.filter(c => c.id !== (payload.old as { id: string }).id))
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
      })

    // Fallback: polling leve a cada 30s caso realtime falhe
    const fallbackInterval = setInterval(() => {
      console.log('[Fallback] Checking for updates...')
      fetchConversations(currentAllowedIds)
    }, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(fallbackInterval)
    }
  }, [initialized, fetchConversations, fetchSingleConversation])

  // Wrapper para refetch que usa os IDs permitidos atuais
  const refetch = useCallback(async () => {
    await fetchConversations(allowedInboxIds)
  }, [fetchConversations, allowedInboxIds])

  return { conversations, isLoading, isSyncing, error, refetch, syncFromChatwoot, markAsRead }
}

export function useConversation(conversationId: string) {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetchConversation() {
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select(`
            *,
            contact:contacts(*),
            stage:kanban_stages(*)
          `)
          .eq('id', conversationId)
          .single()

        if (error) throw error
        setConversation(data as Conversation)
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    if (conversationId) {
      fetchConversation()
    }
  }, [conversationId])

  return { conversation, isLoading, error }
}
