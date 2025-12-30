'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export type ActivityType =
  | 'came_online'
  | 'went_offline'
  | 'resolved_conversations'
  | 'status_changed'
  | 'created_announcement'
  | 'sent_message'

export type TeamActivity = {
  id: string
  company_id: string
  user_id: string
  activity_type: ActivityType
  data: Record<string, unknown>
  created_at: string
  user?: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  }
}

export function useTeamActivities() {
  const { company } = useAuth()
  const [activities, setActivities] = useState<TeamActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Fetch activities
  const fetchActivities = useCallback(async () => {
    if (!company) return

    const supabase = createClient()

    try {
      const { data, error: fetchError } = await supabase
        .from('team_activities')
        .select(`
          *,
          user:users!user_id(id, name, email, avatar_url)
        `)
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (fetchError) throw fetchError

      setActivities(data || [])
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [company])

  // Setup realtime subscription
  useEffect(() => {
    if (!company) return

    fetchActivities()

    const supabase = createClient()

    const channel = supabase
      .channel(`activities-${company.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_activities',
          filter: `company_id=eq.${company.id}`,
        },
        async (payload) => {
          const newActivity = payload.new as TeamActivity

          // Fetch with user data
          const { data } = await supabase
            .from('team_activities')
            .select(`
              *,
              user:users!user_id(id, name, email, avatar_url)
            `)
            .eq('id', newActivity.id)
            .single()

          if (data) {
            setActivities(prev => {
              // Avoid duplicates and limit to 50
              if (prev.some(a => a.id === data.id)) return prev
              return [data, ...prev].slice(0, 50)
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [company, fetchActivities])

  return {
    activities,
    isLoading,
    error,
    refetch: fetchActivities,
  }
}

// Get activity description
export function getActivityDescription(activity: TeamActivity): string {
  const userName = activity.user?.name || 'Usuario'

  switch (activity.activity_type) {
    case 'came_online':
      return `${userName} entrou online`
    case 'went_offline':
      return `${userName} saiu`
    case 'status_changed': {
      const newStatus = activity.data?.new_status as string
      const statusText = activity.data?.status_text as string
      if (statusText) {
        return `${userName} atualizou status: "${statusText}"`
      }
      const statusLabels: Record<string, string> = {
        online: 'Online',
        away: 'Ausente',
        busy: 'Ocupado',
        offline: 'Offline',
      }
      return `${userName} mudou para ${statusLabels[newStatus] || newStatus}`
    }
    case 'resolved_conversations': {
      const count = activity.data?.count as number
      return `${userName} resolveu ${count} conversa${count > 1 ? 's' : ''}`
    }
    case 'created_announcement':
      return `${userName} criou um aviso`
    case 'sent_message':
      return `${userName} enviou uma mensagem`
    default:
      return `${userName} realizou uma acao`
  }
}

// Get activity icon info
export function getActivityIcon(type: ActivityType): {
  icon: string
  color: string
} {
  switch (type) {
    case 'came_online':
      return { icon: 'LogIn', color: 'text-green-500' }
    case 'went_offline':
      return { icon: 'LogOut', color: 'text-gray-500' }
    case 'status_changed':
      return { icon: 'RefreshCw', color: 'text-blue-500' }
    case 'resolved_conversations':
      return { icon: 'CheckCircle', color: 'text-emerald-500' }
    case 'created_announcement':
      return { icon: 'Megaphone', color: 'text-purple-500' }
    case 'sent_message':
      return { icon: 'MessageSquare', color: 'text-indigo-500' }
    default:
      return { icon: 'Activity', color: 'text-gray-500' }
  }
}

// Format activity time
export function formatActivityTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 1) return 'Agora'
  if (diffMins < 60) return `${diffMins}min`
  if (diffHours < 24) return `${diffHours}h`

  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
