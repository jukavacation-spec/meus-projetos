'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export type AgentMetrics = {
  user_id: string
  user: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  }
  resolved_today: number
  active_conversations: number
  total_resolved: number
}

export type TeamMetricsData = {
  agents: AgentMetrics[]
  totals: {
    resolved_today: number
    active_conversations: number
    total_agents: number
  }
}

export function useTeamMetrics() {
  const { company } = useAuth()
  const [metrics, setMetrics] = useState<TeamMetricsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchMetrics = useCallback(async () => {
    if (!company) return

    const supabase = createClient()

    try {
      // Get all team members
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, avatar_url')
        .eq('company_id', company.id)
        .eq('is_active', true)

      if (usersError) throw usersError

      // Get today's start (midnight)
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      // Get conversations data
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id, assigned_to, resolved_at, status')
        .eq('company_id', company.id)

      if (convError) throw convError

      // Calculate metrics per agent
      const agentMetrics: AgentMetrics[] = (users || []).map(user => {
        const userConversations = (conversations || []).filter(c => c.assigned_to === user.id)

        const resolvedToday = userConversations.filter(c =>
          c.resolved_at && new Date(c.resolved_at) >= todayStart
        ).length

        const activeConversations = userConversations.filter(c =>
          c.status !== 'resolved' && c.status !== 'closed'
        ).length

        const totalResolved = userConversations.filter(c => c.resolved_at).length

        return {
          user_id: user.id,
          user,
          resolved_today: resolvedToday,
          active_conversations: activeConversations,
          total_resolved: totalResolved,
        }
      })

      // Sort by resolved today (descending)
      agentMetrics.sort((a, b) => b.resolved_today - a.resolved_today)

      // Calculate totals
      const totals = {
        resolved_today: agentMetrics.reduce((sum, a) => sum + a.resolved_today, 0),
        active_conversations: agentMetrics.reduce((sum, a) => sum + a.active_conversations, 0),
        total_agents: agentMetrics.length,
      }

      setMetrics({ agents: agentMetrics, totals })
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [company])

  // Fetch metrics on mount and every 5 minutes
  useEffect(() => {
    if (!company) return

    fetchMetrics()

    const interval = setInterval(fetchMetrics, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [company, fetchMetrics])

  return {
    metrics,
    isLoading,
    error,
    refetch: fetchMetrics,
  }
}
