'use client'

import { useEffect, useState } from 'react'
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
  contact?: Contact
  stage?: Stage
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetchConversations() {
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select(`
            *,
            contact:contacts(*),
            stage:kanban_stages(*)
          `)
          .order('last_activity_at', { ascending: false })

        if (error) throw error
        setConversations((data || []) as Conversation[])
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchConversations()

    // Realtime subscription
    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          // Refetch para pegar dados relacionados
          fetchConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { conversations, isLoading, error }
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
