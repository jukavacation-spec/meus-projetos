'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PRIORITY_COLUMNS } from '@/lib/constants/kanban-stages'
import type { StackedByField } from './useKanbanConfig'

export type KanbanColumn = {
  id: string
  name: string
  color: string
  position: number
}

type Contact = {
  id: string
  phone: string
  name: string | null
  avatar_url: string | null
}

type User = {
  id: string
  name: string | null
  email: string
  avatar_url: string | null
  chatwoot_agent_id?: number | null
}

export type Conversation = {
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
  contact?: Contact
  chatwoot_conversation_id?: number | null
}

export type KanbanData = {
  columns: KanbanColumn[]
  conversations: Record<string, Conversation[]>
  users?: User[]
}

export interface KanbanFilters {
  inboxIds?: number[]      // IDs das inboxes selecionadas
  statuses?: string[]      // ['open', 'pending', 'resolved']
  assignedTo?: string[]    // UUIDs dos agentes (null = não atribuído)
}

interface UseKanbanOptions {
  stackedBy?: StackedByField
  hiddenColumns?: string[]
  columnOrder?: string[]
  enableRealtime?: boolean
  filters?: KanbanFilters
}

export function useKanban(options: UseKanbanOptions = {}) {
  const {
    stackedBy = 'stage_id',
    hiddenColumns = [],
    columnOrder = [],
    enableRealtime = true,
    filters = {},
  } = options

  // Serialize arrays to prevent infinite loops from referential changes
  const hiddenColumnsKey = useMemo(() => JSON.stringify(hiddenColumns), [hiddenColumns])
  const columnOrderKey = useMemo(() => JSON.stringify(columnOrder), [columnOrder])
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters])

  const [data, setData] = useState<KanbanData>({ columns: [], conversations: {} })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    const supabase = createClient()

    // Parse arrays from serialized keys to ensure we use current values
    const currentHiddenColumns: string[] = JSON.parse(hiddenColumnsKey)
    const currentColumnOrder: string[] = JSON.parse(columnOrderKey)
    const currentFilters: KanbanFilters = JSON.parse(filtersKey)

    try {
      // Buscar conversas com contatos
      let query = supabase
        .from('conversations')
        .select(`
          *,
          contact:contacts(*)
        `)

      // Filtro de status (dinâmico ou default)
      if (currentFilters.statuses && currentFilters.statuses.length > 0) {
        query = query.in('status', currentFilters.statuses)
      } else {
        query = query.in('status', ['open', 'pending']) // default
      }

      // Filtro de inbox
      if (currentFilters.inboxIds && currentFilters.inboxIds.length > 0) {
        query = query.in('chatwoot_inbox_id', currentFilters.inboxIds)
      }

      // Filtro de agente atribuído
      if (currentFilters.assignedTo && currentFilters.assignedTo.length > 0) {
        // Verificar se inclui "não atribuído"
        const hasUnassigned = currentFilters.assignedTo.includes('unassigned')
        const agentIds = currentFilters.assignedTo.filter(id => id !== 'unassigned')

        if (hasUnassigned && agentIds.length > 0) {
          // Inclui não atribuídos E agentes específicos
          query = query.or(`assigned_to.is.null,assigned_to.in.(${agentIds.join(',')})`)
        } else if (hasUnassigned) {
          // Apenas não atribuídos
          query = query.is('assigned_to', null)
        } else if (agentIds.length > 0) {
          // Apenas agentes específicos
          query = query.in('assigned_to', agentIds)
        }
      }

      query = query.order('last_activity_at', { ascending: false })

      const { data: conversations, error: convsError } = await query

      if (convsError) throw convsError

      const convsData = (conversations || []) as Conversation[]

      let columns: KanbanColumn[] = []
      let users: User[] = []

      // Buscar colunas baseado no tipo de agrupamento
      if (stackedBy === 'stage_id') {
        const { data: stages, error: stagesError } = await supabase
          .from('kanban_stages')
          .select('*')
          .order('position', { ascending: true })

        if (stagesError) throw stagesError

        columns = (stages || []).map(stage => ({
          id: stage.id,
          name: stage.name,
          color: stage.color,
          position: stage.position,
        }))
      } else if (stackedBy === 'priority') {
        columns = PRIORITY_COLUMNS
      } else if (stackedBy === 'assigned_to') {
        // Buscar usuários da empresa
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, name, email, avatar_url, chatwoot_agent_id')
          .eq('is_active', true)
          .order('name', { ascending: true })

        if (usersError) throw usersError

        users = (usersData || []) as User[]

        // Criar coluna para cada usuário + "Não atribuído"
        columns = [
          { id: 'unassigned', name: 'Não atribuído', color: '#6b7280', position: 0 },
          ...users.map((user, index) => ({
            id: user.id,
            name: user.name || user.email,
            color: getColorForIndex(index + 1),
            position: index + 1,
          })),
        ]
      }

      // Filtrar colunas ocultas
      if (currentHiddenColumns.length > 0) {
        columns = columns.filter(col => !currentHiddenColumns.includes(col.id))
      }

      // Aplicar ordem customizada
      if (currentColumnOrder.length > 0) {
        columns = columns.sort((a, b) => {
          const indexA = currentColumnOrder.indexOf(a.id)
          const indexB = currentColumnOrder.indexOf(b.id)
          // Se não estiver na ordem customizada, manter no final
          if (indexA === -1 && indexB === -1) return a.position - b.position
          if (indexA === -1) return 1
          if (indexB === -1) return -1
          return indexA - indexB
        })
      }

      // Agrupar conversas por coluna
      const groupedConversations: Record<string, Conversation[]> = {}
      columns.forEach(column => {
        groupedConversations[column.id] = []
      })

      convsData.forEach(conv => {
        let columnId: string | null = null

        if (stackedBy === 'stage_id') {
          columnId = conv.stage_id
        } else if (stackedBy === 'priority') {
          columnId = conv.priority
        } else if (stackedBy === 'assigned_to') {
          columnId = conv.assigned_to || 'unassigned'
        }

        if (columnId && groupedConversations[columnId]) {
          groupedConversations[columnId].push(conv)
        }
      })

      setData({
        columns,
        conversations: groupedConversations,
        users,
      })
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [stackedBy, hiddenColumnsKey, columnOrderKey, filtersKey])

  useEffect(() => {
    fetchData()

    if (!enableRealtime) return

    const supabase = createClient()

    // Realtime subscription para conversas
    const channel = supabase
      .channel(`kanban-changes-${stackedBy}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => fetchData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData, enableRealtime, stackedBy])

  const moveConversation = useCallback(async (
    conversationId: string,
    newColumnId: string
  ) => {
    // Capturar chatwoot_conversation_id antes da atualização otimista
    let chatwootConversationId: number | null = null

    // Encontrar a conversa para capturar chatwoot_conversation_id
    for (const columnId in data.conversations) {
      const conv = data.conversations[columnId].find(c => c.id === conversationId)
      if (conv) {
        chatwootConversationId = conv.chatwoot_conversation_id || null
        break
      }
    }

    // 1. ATUALIZAÇÃO OTIMISTA - Atualiza UI instantaneamente
    setData(prev => {
      const newConversations = { ...prev.conversations }

      // Encontrar e remover da coluna antiga
      let movedConv: Conversation | undefined
      for (const columnId in newConversations) {
        const idx = newConversations[columnId].findIndex(c => c.id === conversationId)
        if (idx !== -1) {
          movedConv = newConversations[columnId][idx]
          newConversations[columnId] = newConversations[columnId].filter(c => c.id !== conversationId)
          break
        }
      }

      // Adicionar na nova coluna
      if (movedConv && newConversations[newColumnId]) {
        if (stackedBy === 'stage_id') {
          movedConv.stage_id = newColumnId
        } else if (stackedBy === 'priority') {
          movedConv.priority = newColumnId
        } else if (stackedBy === 'assigned_to') {
          movedConv.assigned_to = newColumnId === 'unassigned' ? null : newColumnId
        }
        newConversations[newColumnId] = [movedConv, ...newConversations[newColumnId]]
      }

      return { ...prev, conversations: newConversations }
    })

    // 2. Atualizar banco de dados em background
    const supabase = createClient()
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (stackedBy === 'stage_id') {
      updateData.stage_id = newColumnId
    } else if (stackedBy === 'priority') {
      updateData.priority = newColumnId
    } else if (stackedBy === 'assigned_to') {
      updateData.assigned_to = newColumnId === 'unassigned' ? null : newColumnId
    }

    // Fire and forget - não bloqueia a UI
    supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId)
      .then(({ error }) => {
        if (error) {
        }
      })

    // 3. Sincronizar com Chatwoot em background (fire and forget)
    if (stackedBy === 'stage_id') {
      // sync-stage espera o ID interno (UUID) e busca o chatwoot_conversation_id internamente
      fetch(`/api/chatwoot/conversations/${conversationId}/sync-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId: newColumnId })
      }).catch(() => {})
    } else if (stackedBy === 'priority' && chatwootConversationId) {
      // Sincronizar prioridade com Chatwoot
      fetch(`/api/chatwoot/conversations/${chatwootConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'priority', priority: newColumnId })
      }).catch(() => {})
    } else if (stackedBy === 'assigned_to' && chatwootConversationId) {
      // Sincronizar atribuição com Chatwoot
      // Para "unassigned", precisamos desatribuir
      if (newColumnId === 'unassigned') {
        fetch(`/api/chatwoot/conversations/${chatwootConversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unassign' })
        }).catch(() => {})
      } else {
        // Buscar chatwoot_agent_id do usuário
        const targetUser = data.users?.find(u => u.id === newColumnId)
        if (targetUser?.chatwoot_agent_id) {
          fetch(`/api/chatwoot/conversations/${chatwootConversationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'assign', assigneeId: targetUser.chatwoot_agent_id })
          }).catch(() => {})
        }
      }
    }
  }, [stackedBy, data.conversations, data.users])

  return { data, isLoading, error, moveConversation, refetch: fetchData }
}

// Helper para gerar cores diferentes para usuários
function getColorForIndex(index: number): string {
  const colors = [
    '#6366f1', // Indigo
    '#3b82f6', // Blue
    '#22c55e', // Green
    '#eab308', // Yellow
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#14b8a6', // Teal
    '#f97316', // Orange
  ]
  return colors[index % colors.length]
}
