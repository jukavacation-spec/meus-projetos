'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type KanbanStage = {
  id: string
  company_id: string
  name: string
  slug: string
  color: string
  position: number
  is_initial: boolean
  is_final: boolean
}

type Contact = {
  id: string
  phone: string
  name: string | null
  avatar_url: string | null
}

type Conversation = {
  id: string
  company_id: string
  contact_id: string
  stage_id: string | null
  priority: string
  status: string
  subject: string | null
  tags: string[]
  last_activity_at: string
  contact?: Contact
}

type KanbanData = {
  stages: KanbanStage[]
  conversations: Record<string, Conversation[]>
}

export function useKanban() {
  const [data, setData] = useState<KanbanData>({ stages: [], conversations: {} })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    const supabase = createClient()

    try {
      // Buscar stages
      const { data: stages, error: stagesError } = await supabase
        .from('kanban_stages')
        .select('*')
        .order('position', { ascending: true })

      if (stagesError) throw stagesError

      // Buscar conversas com contatos
      const { data: conversations, error: convsError } = await supabase
        .from('conversations')
        .select(`
          *,
          contact:contacts(*)
        `)
        .in('status', ['open', 'pending'])
        .order('last_activity_at', { ascending: false })

      if (convsError) throw convsError

      // Agrupar conversas por stage
      const groupedConversations: Record<string, Conversation[]> = {}
      const stagesData = (stages || []) as KanbanStage[]
      stagesData.forEach(stage => {
        groupedConversations[stage.id] = []
      })

      const convsData = (conversations || []) as Conversation[]
      convsData.forEach(conv => {
        if (conv.stage_id && groupedConversations[conv.stage_id]) {
          groupedConversations[conv.stage_id].push(conv)
        }
      })

      setData({
        stages: stagesData,
        conversations: groupedConversations,
      })
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()

    const supabase = createClient()

    // Realtime subscription para conversas
    const channel = supabase
      .channel('kanban-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => fetchData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData])

  const moveConversation = useCallback(async (
    conversationId: string,
    newStageId: string
  ) => {
    const supabase = createClient()

    const { error } = await supabase
      .from('conversations')
      .update({
        stage_id: newStageId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    if (error) {
      console.error('Error moving conversation:', error)
      throw error
    }

    // Atualizar localmente para feedback imediato
    setData(prev => {
      const newConversations = { ...prev.conversations }

      // Encontrar e remover da coluna antiga
      let movedConv: Conversation | undefined
      for (const stageId in newConversations) {
        const idx = newConversations[stageId].findIndex(c => c.id === conversationId)
        if (idx !== -1) {
          movedConv = newConversations[stageId][idx]
          newConversations[stageId] = newConversations[stageId].filter(c => c.id !== conversationId)
          break
        }
      }

      // Adicionar na nova coluna
      if (movedConv) {
        movedConv.stage_id = newStageId
        newConversations[newStageId] = [movedConv, ...newConversations[newStageId]]
      }

      return { ...prev, conversations: newConversations }
    })
  }, [])

  return { data, isLoading, error, moveConversation, refetch: fetchData }
}
