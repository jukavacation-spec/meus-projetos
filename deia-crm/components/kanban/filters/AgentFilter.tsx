'use client'

import { useState } from 'react'
import { User, ChevronDown, Check, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useTeam } from '@/hooks/useTeam'
import { cn } from '@/lib/utils'

interface AgentFilterProps {
  selected: string[]
  onChange: (ids: string[]) => void
}

export function AgentFilter({ selected, onChange }: AgentFilterProps) {
  const [open, setOpen] = useState(false)
  const { members, isLoading } = useTeam()

  // Filtrar apenas membros ativos
  const activeMembers = members.filter(m => m.is_active)

  const handleToggle = (agentId: string) => {
    if (selected.includes(agentId)) {
      onChange(selected.filter(id => id !== agentId))
    } else {
      onChange([...selected, agentId])
    }
  }

  const handleSelectAll = () => {
    // Inclui todos os agentes + unassigned
    const allIds = ['unassigned', ...activeMembers.map(m => m.id)]
    if (selected.length === allIds.length) {
      onChange([])
    } else {
      onChange(allIds)
    }
  }

  const getLabel = () => {
    if (selected.length === 0) return 'Todos os Agentes'
    if (selected.length === 1) {
      if (selected[0] === 'unassigned') return 'Não atribuído'
      const agent = activeMembers.find(m => m.id === selected[0])
      return agent?.name || agent?.email || 'Agente'
    }
    return `${selected.length} agentes`
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
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">{getLabel()}</span>
          {selected.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-1">
          {/* Select All */}
          <button
            onClick={handleSelectAll}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <Checkbox
              checked={selected.length === activeMembers.length + 1}
              className="pointer-events-none"
            />
            <span className="font-medium">
              {selected.length === activeMembers.length + 1 ? 'Desmarcar todos' : 'Selecionar todos'}
            </span>
          </button>

          <div className="h-px bg-border my-1" />

          {/* Não atribuído */}
          <button
            onClick={() => handleToggle('unassigned')}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <Checkbox
              checked={selected.includes('unassigned')}
              className="pointer-events-none"
            />
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
              <UserX className="h-3 w-3 text-muted-foreground" />
            </div>
            <span className="flex-1 text-left text-muted-foreground">Não atribuído</span>
            {selected.includes('unassigned') && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
          </button>

          <div className="h-px bg-border my-1" />

          {/* Agent list */}
          {isLoading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : activeMembers.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Nenhum agente encontrado
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {activeMembers.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleToggle(agent.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={selected.includes(agent.id)}
                    className="pointer-events-none"
                  />
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={agent.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {agent.name?.charAt(0)?.toUpperCase() || agent.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <div className="font-medium truncate">
                      {agent.name || agent.email}
                    </div>
                    {agent.role?.display_name && (
                      <div className="text-xs text-muted-foreground">
                        {agent.role.display_name}
                      </div>
                    )}
                  </div>
                  {selected.includes(agent.id) && (
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
