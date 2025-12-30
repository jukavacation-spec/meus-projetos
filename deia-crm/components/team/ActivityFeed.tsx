'use client'

import {
  LogIn,
  LogOut,
  RefreshCw,
  CheckCircle,
  Megaphone,
  MessageSquare,
  Activity,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useTeamActivities,
  getActivityDescription,
  formatActivityTime,
  type ActivityType,
} from '@/hooks/useTeamActivities'
import { cn } from '@/lib/utils'

const activityIcons: Record<ActivityType, typeof Activity> = {
  came_online: LogIn,
  went_offline: LogOut,
  status_changed: RefreshCw,
  resolved_conversations: CheckCircle,
  created_announcement: Megaphone,
  sent_message: MessageSquare,
}

const activityColors: Record<ActivityType, string> = {
  came_online: 'text-green-500',
  went_offline: 'text-gray-500',
  status_changed: 'text-blue-500',
  resolved_conversations: 'text-emerald-500',
  created_announcement: 'text-purple-500',
  sent_message: 'text-indigo-500',
}

export function ActivityFeed() {
  const { activities, isLoading } = useTeamActivities()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Atividades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Atividades</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          {activities.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma atividade recente</p>
            </div>
          ) : (
            <div className="px-4 pb-4">
              {activities.map((activity, index) => {
                const Icon = activityIcons[activity.activity_type] || Activity
                const color = activityColors[activity.activity_type] || 'text-gray-500'

                return (
                  <div
                    key={activity.id}
                    className={cn(
                      'flex items-start gap-3 py-3',
                      index !== activities.length - 1 && 'border-b'
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={activity.user?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {activity.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          'absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background flex items-center justify-center'
                        )}
                      >
                        <Icon className={cn('h-3 w-3', color)} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        {getActivityDescription(activity)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatActivityTime(activity.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
