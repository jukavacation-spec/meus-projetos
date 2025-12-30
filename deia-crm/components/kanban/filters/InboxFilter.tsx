'use client'

import { useState } from 'react'
import { Check, MessageSquare, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useInboxes, getChannelName } from '@/hooks/useInboxes'
import { cn } from '@/lib/utils'

interface InboxFilterProps {
  selected: number[]
  onChange: (ids: number[]) => void
}

export function InboxFilter({ selected, onChange }: InboxFilterProps) {
  const [open, setOpen] = useState(false)
  const { activeInboxes, isLoading } = useInboxes()

  const handleToggle = (inboxId: number) => {
    if (selected.includes(inboxId)) {
      onChange(selected.filter(id => id !== inboxId))
    } else {
      onChange([...selected, inboxId])
    }
  }

  const handleSelectAll = () => {
    if (selected.length === activeInboxes.length) {
      onChange([])
    } else {
      onChange(activeInboxes.map(inbox => inbox.id))
    }
  }

  const getLabel = () => {
    if (selected.length === 0) return 'Todas as Inboxes'
    if (selected.length === 1) {
      const inbox = activeInboxes.find(i => i.id === selected[0])
      return inbox?.name || 'Inbox'
    }
    return `${selected.length} inboxes`
  }

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
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">{getLabel()}</span>
          {selected.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1">
          {/* Select All */}
          <button
            onClick={handleSelectAll}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <Checkbox
              checked={selected.length === activeInboxes.length && activeInboxes.length > 0}
              className="pointer-events-none"
            />
            <span className="font-medium">
              {selected.length === activeInboxes.length ? 'Desmarcar todas' : 'Selecionar todas'}
            </span>
          </button>

          <div className="h-px bg-border my-1" />

          {/* Inbox list */}
          {isLoading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : activeInboxes.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma inbox encontrada
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {activeInboxes.map((inbox) => (
                <button
                  key={inbox.id}
                  onClick={() => handleToggle(inbox.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={selected.includes(inbox.id)}
                    className="pointer-events-none"
                  />
                  <div className="flex-1 text-left">
                    <div className="font-medium truncate">{inbox.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {getChannelName(inbox.channel_type)}
                    </div>
                  </div>
                  {selected.includes(inbox.id) && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
