'use client'

import { MessageSquare, Crown, Shield, User, MoreVertical } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { PresenceIndicator } from './PresenceIndicator'
import { useTeam } from '@/hooks/useTeam'
import { useTeamPresence, formatLastSeen } from '@/hooks/useTeamPresence'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

type TeamMembersListProps = {
  onMessageClick?: (userId: string, userName: string) => void
}

export function TeamMembersList({ onMessageClick }: TeamMembersListProps) {
  const { members, isLoading } = useTeam()
  const { getPresence, getStatusLabel } = useTeamPresence()
  const { user } = useAuth()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Equipe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const getRoleIcon = (roleName: string) => {
    switch (roleName) {
      case 'owner':
        return <Crown className="h-3 w-3 text-yellow-500" />
      case 'admin':
        return <Shield className="h-3 w-3 text-blue-500" />
      default:
        return <User className="h-3 w-3 text-gray-500" />
    }
  }

  // Sort members: online first, then by name
  const sortedMembers = [...members].sort((a, b) => {
    const presenceA = getPresence(a.id)
    const presenceB = getPresence(b.id)
    const statusOrder = { online: 0, busy: 1, away: 2, offline: 3 }
    const orderA = statusOrder[presenceA?.status || 'offline']
    const orderB = statusOrder[presenceB?.status || 'offline']
    if (orderA !== orderB) return orderA - orderB
    return (a.name || '').localeCompare(b.name || '')
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Equipe</CardTitle>
          <Badge variant="secondary">{members.length} membros</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedMembers.map((member) => {
            const presence = getPresence(member.id)
            const status = presence?.status || 'offline'
            const isMe = member.id === user?.id

            return (
              <div
                key={member.id}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-lg transition-colors',
                  'hover:bg-muted/50',
                  isMe && 'bg-muted/30'
                )}
              >
                {/* Avatar with presence */}
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback>
                      {member.name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background p-0.5">
                    <PresenceIndicator status={status} size="sm" />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {member.name || member.email}
                    </span>
                    {isMe && (
                      <Badge variant="outline" className="text-xs">
                        Voce
                      </Badge>
                    )}
                    {member.role && getRoleIcon(member.role.name)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{getStatusLabel(status)}</span>
                    {presence?.status_text && (
                      <>
                        <span>-</span>
                        <span className="truncate">{presence.status_text}</span>
                      </>
                    )}
                    {status === 'offline' && presence?.last_seen_at && (
                      <>
                        <span>-</span>
                        <span>{formatLastSeen(presence.last_seen_at)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!isMe && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onMessageClick?.(member.id, member.name || member.email)}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Enviar mensagem
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
