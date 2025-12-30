'use client'

import { Layers, Columns3 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { STACKED_BY_OPTIONS } from '@/lib/constants/kanban-stages'
import { KanbanFilters } from './KanbanFilters'
import type { KanbanColumn, KanbanFilters as KanbanFiltersType } from '@/hooks/useKanban'
import type { StackedByField } from '@/hooks/useKanbanConfig'

interface KanbanToolbarProps {
  stackedBy: StackedByField
  onStackedByChange: (value: StackedByField) => void
  allColumns: KanbanColumn[]
  hiddenColumns: string[]
  onToggleColumn: (columnId: string) => void
  filters: KanbanFiltersType
  onFiltersChange: (filters: KanbanFiltersType) => void
  activeFiltersCount: number
}

export function KanbanToolbar({
  stackedBy,
  onStackedByChange,
  allColumns,
  hiddenColumns,
  onToggleColumn,
  filters,
  onFiltersChange,
  activeFiltersCount,
}: KanbanToolbarProps) {
  const visibleCount = allColumns.length - hiddenColumns.length
  const totalCount = allColumns.length

  return (
    <div className="flex items-center gap-3 mb-4">
      {/* Seletor de agrupamento */}
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <Select
          value={stackedBy}
          onValueChange={(value) => onStackedByChange(value as StackedByField)}
        >
          <SelectTrigger className="w-[180px]" size="sm">
            <SelectValue placeholder="Agrupar por..." />
          </SelectTrigger>
          <SelectContent>
            {STACKED_BY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex flex-col">
                  <span>{option.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Menu de visibilidade de colunas */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Columns3 className="h-4 w-4" />
            <span>Colunas</span>
            <span className="text-muted-foreground text-xs">
              ({visibleCount}/{totalCount})
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-4">
            <div className="space-y-1">
              <h4 className="font-medium text-sm">Colunas visíveis</h4>
              <p className="text-xs text-muted-foreground">
                Selecione quais colunas deseja exibir no Kanban
              </p>
            </div>
            <div className="space-y-2">
              {allColumns.map((column) => {
                const isVisible = !hiddenColumns.includes(column.id)
                return (
                  <div
                    key={column.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: column.color }}
                      />
                      <Label
                        htmlFor={`column-${column.id}`}
                        className="text-sm truncate cursor-pointer"
                      >
                        {column.name}
                      </Label>
                    </div>
                    <Switch
                      id={`column-${column.id}`}
                      checked={isVisible}
                      onCheckedChange={() => onToggleColumn(column.id)}
                    />
                  </div>
                )
              })}
            </div>
            {hiddenColumns.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  hiddenColumns.forEach((id) => onToggleColumn(id))
                }}
              >
                Mostrar todas ({hiddenColumns.length} ocultas)
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Filtros */}
      <KanbanFilters
        filters={filters}
        onFiltersChange={onFiltersChange}
        activeCount={activeFiltersCount}
      />
    </div>
  )
}
