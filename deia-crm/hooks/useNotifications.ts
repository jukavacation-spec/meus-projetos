'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export type NotificationType =
  | 'new_conversation'
  | 'new_message'
  | 'assigned'
  | 'mention'
  | 'resolved'
  | 'team_invite'

export type Notification = {
  id: string
  company_id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  reference_type: string | null
  reference_id: string | null
  metadata: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export type NotificationPreferences = {
  id: string
  user_id: string
  email_enabled: boolean
  push_enabled: boolean
  sound_enabled: boolean
  notify_new_conversation: boolean
  notify_new_message: boolean
  notify_assigned: boolean
  notify_mention: boolean
  notify_resolved: boolean
  notify_team_invite: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start: string
  quiet_hours_end: string
}

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'id' | 'user_id'> = {
  email_enabled: true,
  push_enabled: true,
  sound_enabled: true,
  notify_new_conversation: true,
  notify_new_message: true,
  notify_assigned: true,
  notify_mention: true,
  notify_resolved: true,
  notify_team_invite: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
}

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchNotifications = useCallback(async () => {
    if (!user) return

    const supabase = createClient()

    try {
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (fetchError) throw fetchError

      const notifs = data || []
      setNotifications(notifs)
      setUnreadCount(notifs.filter(n => !n.read_at).length)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  const markAsRead = useCallback(async (notificationId: string) => {
    const supabase = createClient()

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)

      if (updateError) throw updateError

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (!user) return

    const supabase = createClient()

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null)

      if (updateError) throw updateError

      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      )
      setUnreadCount(0)
    } catch {
    }
  }, [user])

  const deleteNotification = useCallback(async (notificationId: string) => {
    const supabase = createClient()

    try {
      const notif = notifications.find(n => n.id === notificationId)

      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      if (deleteError) throw deleteError

      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      if (notif && !notif.read_at) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch {
    }
  }, [notifications])

  const clearAll = useCallback(async () => {
    if (!user) return

    const supabase = createClient()

    try {
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) throw deleteError

      setNotifications([])
      setUnreadCount(0)
    } catch {
    }
  }, [user])

  // Setup realtime subscription
  useEffect(() => {
    if (!user) return

    fetchNotifications()

    const supabase = createClient()

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification
          setNotifications(prev => [newNotification, ...prev])
          setUnreadCount(prev => prev + 1)

          // Play sound if enabled (will check preferences in component)
          const audio = new Audio('/sounds/notification.mp3')
          audio.volume = 0.5
          audio.play().catch(() => {
            // Ignore autoplay errors
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchNotifications])

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refetch: fetchNotifications,
  }
}

export function useNotificationPreferences() {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchPreferences = useCallback(async () => {
    if (!user) return

    const supabase = createClient()

    try {
      const { data, error: fetchError } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError
      }

      if (data) {
        setPreferences(data)
      } else {
        // Create default preferences if not exist
        const { data: newPrefs, error: createError } = await supabase
          .from('notification_preferences')
          .insert({ user_id: user.id, ...DEFAULT_PREFERENCES })
          .select()
          .single()

        if (createError) throw createError
        setPreferences(newPrefs)
      }
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    if (!user || !preferences) return

    setIsSaving(true)
    const supabase = createClient()

    try {
      const { data, error: updateError } = await supabase
        .from('notification_preferences')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError) throw updateError

      setPreferences(data)
      return data
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setIsSaving(false)
    }
  }, [user, preferences])

  useEffect(() => {
    fetchPreferences()
  }, [fetchPreferences])

  return {
    preferences,
    isLoading,
    isSaving,
    error,
    updatePreferences,
    refetch: fetchPreferences,
  }
}

// Helper to format notification time
export function formatNotificationTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Agora'
  if (diffMins < 60) return `${diffMins}min`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// Helper to get notification icon info
export function getNotificationIcon(type: NotificationType): {
  icon: string
  color: string
} {
  switch (type) {
    case 'new_conversation':
      return { icon: 'MessageCircle', color: 'text-blue-500' }
    case 'new_message':
      return { icon: 'MessageSquare', color: 'text-green-500' }
    case 'assigned':
      return { icon: 'UserCheck', color: 'text-purple-500' }
    case 'mention':
      return { icon: 'AtSign', color: 'text-orange-500' }
    case 'resolved':
      return { icon: 'CheckCircle', color: 'text-emerald-500' }
    case 'team_invite':
      return { icon: 'UserPlus', color: 'text-indigo-500' }
    default:
      return { icon: 'Bell', color: 'text-gray-500' }
  }
}
