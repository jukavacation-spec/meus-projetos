'use client'

import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { PresenceIndicator } from './PresenceIndicator'
import { useTeamPresence, type PresenceStatus } from '@/hooks/useTeamPresence'

const STATUS_OPTIONS: { value: PresenceStatus; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'away', label: 'Ausente' },
  { value: 'busy', label: 'Ocupado' },
  { value: 'offline', label: 'Invisivel' },
]

export function PresenceSelector() {
  const { myPresence, updateMyPresence, getStatusLabel } = useTeamPresence()
  const [statusText, setStatusText] = useState(myPresence?.status_text || '')
  const [isEditing, setIsEditing] = useState(false)

  const handleStatusChange = async (status: PresenceStatus) => {
    await updateMyPresence(status, statusText || null)
  }

  const handleStatusTextSave = async () => {
    if (myPresence) {
      await updateMyPresence(myPresence.status, statusText || null)
    }
    setIsEditing(false)
  }

  const currentStatus = myPresence?.status || 'offline'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <PresenceIndicator status={currentStatus} size="sm" showPulse={false} />
          <span className="hidden sm:inline">{getStatusLabel(currentStatus)}</span>
          {myPresence?.status_text && (
            <span className="text-muted-foreground text-xs hidden md:inline">
              - {myPresence.status_text}
            </span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {STATUS_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleStatusChange(option.value)}
            className="gap-2"
          >
            <PresenceIndicator status={option.value} size="sm" showPulse={false} />
            <span className="flex-1">{option.label}</span>
            {currentStatus === option.value && (
              <Check className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground mb-2">Status personalizado</p>
          {isEditing ? (
            <div className="flex gap-2">
              <Input
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                placeholder="Ex: Em reuniao ate 14h"
                className="h-8 text-sm"
                maxLength={50}
              />
              <Button size="sm" onClick={handleStatusTextSave}>
                OK
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => setIsEditing(true)}
            >
              {statusText || 'Definir status...'}
            </Button>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
