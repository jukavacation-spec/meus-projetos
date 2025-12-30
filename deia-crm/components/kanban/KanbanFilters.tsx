'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InboxFilter } from './filters/InboxFilter'
import { StatusFilter } from './filters/StatusFilter'
import { AgentFilter } from './filters/AgentFilter'
import type { KanbanFilters as KanbanFiltersType } from '@/hooks/useKanban'

interface KanbanFiltersProps {
  filters: KanbanFiltersType
  onFiltersChange: (filters: KanbanFiltersType) => void
  activeCount: number
}

export function KanbanFilters({
  filters,
  onFiltersChange,
  activeCount,
}: KanbanFiltersProps) {
  const handleClearAll = () => {
    onFiltersChange({})
  }

  return (
    <div className="flex items-center gap-2">
      {/* Separador visual */}
      <div className="h-6 w-px bg-border hidden sm:block" />

      {/* Filtro de Inbox */}
      <InboxFilter
        selected={filters.inboxIds || []}
        onChange={(inboxIds) => onFiltersChange({ ...filters, inboxIds })}
      />

      {/* Filtro de Status */}
      <StatusFilter
        selected={filters.statuses || []}
        onChange={(statuses) => onFiltersChange({ ...filters, statuses })}
      />

      {/* Filtro de Agente */}
      <AgentFilter
        selected={filters.assignedTo || []}
        onChange={(assignedTo) => onFiltersChange({ ...filters, assignedTo })}
      />

      {/* Botão Limpar Filtros */}
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-muted-foreground hover:text-foreground"
          onClick={handleClearAll}
        >
          <X className="h-3 w-3" />
          <span className="hidden sm:inline">Limpar</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {activeCount}
          </Badge>
        </Button>
      )}
    </div>
  )
}
