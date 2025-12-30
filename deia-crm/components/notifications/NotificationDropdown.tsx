'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  MessageCircle,
  MessageSquare,
  UserCheck,
  AtSign,
  CheckCircle,
  UserPlus,
  Check,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  useNotifications,
  formatNotificationTime,
  type Notification,
  type NotificationType,
} from '@/hooks/useNotifications'

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'new_conversation':
      return <MessageCircle className="h-4 w-4 text-blue-500" />
    case 'new_message':
      return <MessageSquare className="h-4 w-4 text-green-500" />
    case 'assigned':
      return <UserCheck className="h-4 w-4 text-purple-500" />
    case 'mention':
      return <AtSign className="h-4 w-4 text-orange-500" />
    case 'resolved':
      return <CheckCircle className="h-4 w-4 text-emerald-500" />
    case 'team_invite':
      return <UserPlus className="h-4 w-4 text-indigo-500" />
    default:
      return <Bell className="h-4 w-4 text-gray-500" />
  }
}

function NotificationItem({
  notification,
  onRead,
  onDelete,
  onClick,
}: {
  notification: Notification
  onRead: () => void
  onDelete: () => void
  onClick: () => void
}) {
  const isUnread = !notification.read_at

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors',
        isUnread && 'bg-muted/30'
      )}
      onClick={onClick}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm', isUnread && 'font-medium')}>
            {notification.title}
          </p>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatNotificationTime(notification.created_at)}
          </span>
        </div>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}
      </div>
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        {isUnread && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation()
              onRead()
            }}
            title="Marcar como lida"
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          title="Excluir"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

export function NotificationDropdown() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications()

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read_at) {
      markAsRead(notification.id)
    }

    // Navigate based on reference type
    if (notification.reference_type === 'conversation' && notification.reference_id) {
      router.push(`/conversations/${notification.reference_id}`)
      setOpen(false)
    } else if (notification.reference_type === 'contact' && notification.reference_id) {
      router.push(`/contacts/${notification.reference_id}`)
      setOpen(false)
    } else if (notification.reference_type === 'invite') {
      router.push('/settings?tab=team')
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">Notificacoes</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={markAllAsRead}
              >
                <Check className="h-3 w-3 mr-1" />
                Marcar todas como lidas
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={clearAll}
                title="Limpar todas"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Nenhuma notificacao</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={() => markAsRead(notification.id)}
                  onDelete={() => deleteNotification(notification.id)}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              router.push('/settings?tab=notifications')
              setOpen(false)
            }}
          >
            Configuracoes de notificacao
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
