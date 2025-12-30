'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { KanbanFilters } from './useKanban'

export type StackedByField = 'stage_id' | 'priority' | 'assigned_to'

export interface KanbanConfig {
  id?: string
  stackedBy: StackedByField
  hiddenColumns: string[]
  columnOrder: string[]
  filters: KanbanFilters
}

const DEFAULT_CONFIG: KanbanConfig = {
  stackedBy: 'stage_id',
  hiddenColumns: [],
  columnOrder: [],
  filters: {},
}

export function useKanbanConfig() {
  const { user, profile } = useAuth()
  const [config, setConfig] = useState<KanbanConfig>(DEFAULT_CONFIG)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Debounce timer ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchConfig = useCallback(async () => {
    if (!user || !profile?.company_id) return

    const supabase = createClient()

    try {
      const { data, error: fetchError } = await supabase
        .from('kanban_view_config')
        .select('*')
        .eq('user_id', user.id)
        .eq('company_id', profile.company_id)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows returned (not an error, just no config yet)
        throw fetchError
      }

      if (data) {
        setConfig({
          id: data.id,
          stackedBy: data.stacked_by as StackedByField,
          hiddenColumns: data.hidden_columns || [],
          columnOrder: data.column_order || [],
          filters: data.filters || {},
        })
      }
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [user, profile?.company_id])

  useEffect(() => {
    if (user && profile?.company_id) {
      fetchConfig()
    } else {
      setIsLoading(false)
    }
  }, [user, profile?.company_id, fetchConfig])

  // Debounced save function
  const saveConfig = useCallback(async (newConfig: Partial<KanbanConfig>) => {
    if (!user || !profile?.company_id) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Update local state immediately (optimistic update)
    setConfig(prev => ({ ...prev, ...newConfig }))

    // Debounce the actual save
    saveTimeoutRef.current = setTimeout(async () => {
      const supabase = createClient()

      try {
        const updateData = {
          user_id: user.id,
          company_id: profile.company_id,
          stacked_by: newConfig.stackedBy ?? config.stackedBy,
          hidden_columns: newConfig.hiddenColumns ?? config.hiddenColumns,
          column_order: newConfig.columnOrder ?? config.columnOrder,
          filters: newConfig.filters ?? config.filters,
          updated_at: new Date().toISOString(),
        }

        const { error: saveError } = await supabase
          .from('kanban_view_config')
          .upsert(updateData, {
            onConflict: 'user_id,company_id',
          })

        if (saveError) throw saveError
      } catch (err) {
        setError(err as Error)
        // Revert on error
        fetchConfig()
      }
    }, 300) // 300ms debounce
  }, [user, profile?.company_id, config, fetchConfig])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Update stacked by field
  const updateStackedBy = useCallback((field: StackedByField) => {
    // Reset column order and hidden when changing stacked by
    saveConfig({
      stackedBy: field,
      columnOrder: [],
      hiddenColumns: [],
    })
  }, [saveConfig])

  // Toggle column visibility
  const toggleColumnVisibility = useCallback((columnId: string) => {
    const newHiddenColumns = config.hiddenColumns.includes(columnId)
      ? config.hiddenColumns.filter(id => id !== columnId)
      : [...config.hiddenColumns, columnId]

    saveConfig({ hiddenColumns: newHiddenColumns })
  }, [config.hiddenColumns, saveConfig])

  // Show column (remove from hidden)
  const showColumn = useCallback((columnId: string) => {
    const newHiddenColumns = config.hiddenColumns.filter(id => id !== columnId)
    saveConfig({ hiddenColumns: newHiddenColumns })
  }, [config.hiddenColumns, saveConfig])

  // Hide column (add to hidden)
  const hideColumn = useCallback((columnId: string) => {
    if (!config.hiddenColumns.includes(columnId)) {
      saveConfig({ hiddenColumns: [...config.hiddenColumns, columnId] })
    }
  }, [config.hiddenColumns, saveConfig])

  // Reorder columns
  const reorderColumns = useCallback((newOrder: string[]) => {
    saveConfig({ columnOrder: newOrder })
  }, [saveConfig])

  // Check if column is hidden
  const isColumnHidden = useCallback((columnId: string) => {
    return config.hiddenColumns.includes(columnId)
  }, [config.hiddenColumns])

  // Update filters
  const updateFilters = useCallback((newFilters: KanbanFilters) => {
    saveConfig({ filters: newFilters })
  }, [saveConfig])

  // Clear all filters
  const clearFilters = useCallback(() => {
    saveConfig({ filters: {} })
  }, [saveConfig])

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (config.filters.inboxIds?.length) count++
    if (config.filters.statuses?.length) count++
    if (config.filters.assignedTo?.length) count++
    return count
  }, [config.filters])

  return {
    config,
    isLoading,
    error,
    updateStackedBy,
    toggleColumnVisibility,
    showColumn,
    hideColumn,
    reorderColumns,
    isColumnHidden,
    updateFilters,
    clearFilters,
    activeFiltersCount,
    refetch: fetchConfig,
  }
}
