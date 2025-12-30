'use client'

import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PresenceSelector } from '@/components/team/PresenceSelector'
import { TeamMembersList } from '@/components/team/TeamMembersList'
import { TeamAnnouncements } from '@/components/team/TeamAnnouncements'
import { PrivateMessages } from '@/components/team/PrivateMessages'
import { ActivityFeed } from '@/components/team/ActivityFeed'
import { TeamMetrics } from '@/components/team/TeamMetrics'
import { useTeamMessages } from '@/hooks/useTeamMessages'

export default function TeamPage() {
  const { totalUnread } = useTeamMessages()
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>()
  const [selectedUserName, setSelectedUserName] = useState<string | undefined>()

  const handleMessageClick = (userId: string, userName: string) => {
    setSelectedUserId(userId)
    setSelectedUserName(userName)
    setMessagesOpen(true)
  }

  const handleMessagesClose = (open: boolean) => {
    if (!open) {
      setSelectedUserId(undefined)
      setSelectedUserName(undefined)
    }
    setMessagesOpen(open)
  }

  return (
    <>
      <Header title="Equipe">
        <div className="flex items-center gap-3">
          <PresenceSelector />
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setMessagesOpen(true)}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Mensagens</span>
            {totalUnread > 0 && (
              <Badge className="h-5 min-w-[20px] px-1.5">
                {totalUnread > 99 ? '99+' : totalUnread}
              </Badge>
            )}
          </Button>
        </div>
      </Header>

      <div className="p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column - Members and Announcements */}
          <div className="lg:col-span-2 space-y-6">
            {/* Metrics */}
            <TeamMetrics />

            {/* Members */}
            <TeamMembersList onMessageClick={handleMessageClick} />
          </div>

          {/* Right column - Announcements and Activity */}
          <div className="space-y-6">
            {/* Announcements */}
            <TeamAnnouncements />

            {/* Activity Feed */}
            <ActivityFeed />
          </div>
        </div>
      </div>

      {/* Private Messages Sheet */}
      <PrivateMessages
        open={messagesOpen}
        onOpenChange={handleMessagesClose}
        initialUserId={selectedUserId}
        initialUserName={selectedUserName}
      />
    </>
  )
}
