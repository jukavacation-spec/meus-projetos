'use client'

import { useState } from 'react'
import { CircleDot, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface StatusFilterProps {
  selected: string[]
  onChange: (statuses: string[]) => void
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Abertas', color: 'bg-green-500' },
  { value: 'pending', label: 'Pendentes', color: 'bg-yellow-500' },
  { value: 'resolved', label: 'Resolvidas', color: 'bg-gray-400' },
]

export function StatusFilter({ selected, onChange }: StatusFilterProps) {
  const [open, setOpen] = useState(false)

  const handleToggle = (status: string) => {
    if (selected.includes(status)) {
      onChange(selected.filter(s => s !== status))
    } else {
      onChange([...selected, status])
    }
  }

  const getLabel = () => {
    if (selected.length === 0) return 'Todos os Status'
    if (selected.length === 1) {
      const status = STATUS_OPTIONS.find(s => s.value === selected[0])
      return status?.label || 'Status'
    }
    return `${selected.length} status`
  }

  // Se nenhum status selecionado, mostrar o default (open + pending)
  const effectiveSelected = selected.length > 0 ? selected : ['open', 'pending']
  const isDefault = selected.length === 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-2',
            selected.length > 0 && 'border-primary'
          )}
        >
          <CircleDot className="h-4 w-4" />
          <span className="hidden sm:inline">{getLabel()}</span>
          {selected.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-1">
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
            Filtrar por status
          </div>

          {STATUS_OPTIONS.map((status) => {
            const isSelected = effectiveSelected.includes(status.value)
            const isDefaultSelected = isDefault && (status.value === 'open' || status.value === 'pending')

            return (
              <button
                key={status.value}
                onClick={() => handleToggle(status.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox
                  checked={isSelected}
                  className="pointer-events-none"
                />
                <div className={cn('h-2 w-2 rounded-full', status.color)} />
                <span className="flex-1 text-left">{status.label}</span>
                {isDefaultSelected && !selected.length && (
                  <span className="text-xs text-muted-foreground">(padrão)</span>
                )}
                {selected.includes(status.value) && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </button>
            )
          })}

          <div className="h-px bg-border my-1" />

          <button
            onClick={() => onChange([])}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            Resetar para padrão
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
