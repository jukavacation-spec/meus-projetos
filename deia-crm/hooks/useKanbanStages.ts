'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'

export type KanbanStage = {
  id: string
  company_id: string
  name: string
  slug: string
  description: string | null
  color: string
  position: number
  is_initial: boolean
  is_final: boolean
  auto_archive_days: number | null
  created_at: string
}

export type KanbanStageInput = {
  name: string
  description?: string | null
  color?: string
  position?: number
  is_initial?: boolean
  is_final?: boolean
  auto_archive_days?: number | null
}

// Cores predefinidas para os estágios
export const STAGE_COLORS = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#eab308', label: 'Amarelo' },
  { value: '#f59e0b', label: 'Laranja' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#8b5cf6', label: 'Violeta' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#6b7280', label: 'Cinza' },
]

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function useKanbanStages() {
  const { profile } = useAuth()
  const [stages, setStages] = useState<KanbanStage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchStages = useCallback(async () => {
    if (!profile?.company_id) {
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    try {
      const { data, error: fetchError } = await supabase
        .from('kanban_stages')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('position', { ascending: true })

      if (fetchError) throw fetchError

      setStages(data || [])
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [profile?.company_id])

  const createStage = useCallback(async (input: KanbanStageInput) => {
    if (!profile?.company_id) {
      throw new Error('Empresa nao encontrada')
    }

    const supabase = createClient()

    // Determinar a posicao (ultima + 1)
    const maxPosition = stages.length > 0 ? Math.max(...stages.map(s => s.position)) : -1
    const position = input.position ?? maxPosition + 1

    // Se marcando como inicial, desmarcar outros
    if (input.is_initial) {
      await supabase
        .from('kanban_stages')
        .update({ is_initial: false })
        .eq('company_id', profile.company_id)
    }

    const { data, error: createError } = await supabase
      .from('kanban_stages')
      .insert({
        company_id: profile.company_id,
        name: input.name,
        slug: generateSlug(input.name),
        description: input.description || null,
        color: input.color || '#6366f1',
        position,
        is_initial: input.is_initial || false,
        is_final: input.is_final || false,
        auto_archive_days: input.auto_archive_days || null,
      })
      .select()
      .single()

    if (createError) throw createError

    // Sincronizar com Chatwoot - criar label correspondente
    try {
      await fetch('/api/chatwoot/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generateSlug(input.name),
          color: input.color || '#6366f1',
          description: input.name,
        }),
      })
    } catch {
    }

    await fetchStages() // Refresh to get correct order
    return data
  }, [profile?.company_id, stages, fetchStages])

  const updateStage = useCallback(async (id: string, input: Partial<KanbanStageInput>) => {
    if (!profile?.company_id) {
      throw new Error('Empresa nao encontrada')
    }

    const supabase = createClient()

    const updateData: Record<string, unknown> = {}
    if (input.name !== undefined) {
      updateData.name = input.name
      updateData.slug = generateSlug(input.name)
    }
    if (input.description !== undefined) updateData.description = input.description || null
    if (input.color !== undefined) updateData.color = input.color
    if (input.position !== undefined) updateData.position = input.position
    if (input.is_initial !== undefined) updateData.is_initial = input.is_initial
    if (input.is_final !== undefined) updateData.is_final = input.is_final
    if (input.auto_archive_days !== undefined) updateData.auto_archive_days = input.auto_archive_days || null

    // Se marcando como inicial, desmarcar outros
    if (input.is_initial) {
      await supabase
        .from('kanban_stages')
        .update({ is_initial: false })
        .eq('company_id', profile.company_id)
        .neq('id', id)
    }

    // Buscar o slug atual antes de atualizar (para sincronizar com Chatwoot)
    const currentStage = stages.find(s => s.id === id)
    const oldSlug = currentStage?.slug
    const newSlug = input.name ? generateSlug(input.name) : oldSlug

    const { data, error: updateError } = await supabase
      .from('kanban_stages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    // Sincronizar com Chatwoot se nome ou cor mudou
    if ((input.name || input.color) && oldSlug) {
      try {
        // Primeiro, buscar todas as labels para encontrar o ID da label antiga
        const labelsResponse = await fetch('/api/chatwoot/labels')
        if (labelsResponse.ok) {
          const labelsData = await labelsResponse.json()
          const existingLabel = labelsData.labels?.find(
            (l: { title: string }) => l.title === oldSlug
          )

          if (existingLabel) {
            // Atualizar label existente
            await fetch('/api/chatwoot/labels', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: existingLabel.id,
                title: newSlug,
                color: input.color || currentStage?.color || '#6366f1',
                description: input.name || currentStage?.name,
              }),
            })
          } else if (input.name) {
            // Label não existe, criar nova
            await fetch('/api/chatwoot/labels', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: newSlug,
                color: input.color || currentStage?.color || '#6366f1',
                description: input.name,
              }),
            })
          }
        }
      } catch {
      }
    }

    setStages(prev => prev.map(s => s.id === id ? (data as KanbanStage) : s))
    return data
  }, [profile?.company_id, stages])

  const deleteStage = useCallback(async (id: string) => {
    const supabase = createClient()

    // Verificar se ha conversas neste estagio
    const { count } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('stage_id', id)

    if (count && count > 0) {
      throw new Error(`Existem ${count} conversas neste estagio. Mova-as antes de excluir.`)
    }

    const { error: deleteError } = await supabase
      .from('kanban_stages')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    setStages(prev => prev.filter(s => s.id !== id))
  }, [])

  const reorderStages = useCallback(async (orderedIds: string[]) => {
    const supabase = createClient()

    // Atualizar posicoes
    const updates = orderedIds.map((id, index) => ({
      id,
      position: index,
    }))

    for (const update of updates) {
      await supabase
        .from('kanban_stages')
        .update({ position: update.position })
        .eq('id', update.id)
    }

    // Atualizar estado local
    setStages(prev => {
      const stageMap = new Map(prev.map(s => [s.id, s]))
      return orderedIds.map((id, index) => ({
        ...stageMap.get(id)!,
        position: index,
      }))
    })
  }, [])

  useEffect(() => {
    if (profile?.company_id) {
      fetchStages()
    }
  }, [profile?.company_id, fetchStages])

  return {
    stages,
    isLoading,
    error,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
    refetch: fetchStages,
  }
}
