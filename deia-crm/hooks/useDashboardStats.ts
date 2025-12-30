'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { startOfDay, subDays, addDays, differenceInMinutes, format } from 'date-fns'

export type PeriodType = 'today' | '7d' | '30d' | '90d'

type AgentStats = {
  id: string
  name: string
  email: string
  avatar_url: string | null
  conversations: number
  resolved: number
  avgResponseTime: number | null
}

type DailyCount = {
  date: string
  count: number
}

type StatusCount = {
  status: string
  count: number
}

type StageCount = {
  id: string
  name: string
  slug: string
  color: string
  count: number
  percentage: number
  isFinal: boolean
}

export type DashboardStats = {
  // Conversas
  totalConversations: number
  openConversations: number
  pendingConversations: number
  resolvedConversations: number
  resolvedInPeriod: number

  // Contatos
  totalContacts: number
  newContactsInPeriod: number

  // Performance
  avgResponseTime: number | null // em minutos
  resolutionRate: number // percentual

  // Comparacao com periodo anterior
  conversationsTrend: number | null
  contactsTrend: number | null
  resolutionTrend: number | null
  responseTimeTrend: number | null

  // Graficos
  conversationsByDay: DailyCount[]
  conversationsByStatus: StatusCount[]

  // Agentes
  topAgents: AgentStats[]

  // Funil de vendas (Kanban)
  conversationsByStage: StageCount[]
  wonConversations: number
  lostConversations: number
  conversionRate: number // % que chegou em ganho
  waitingConversations: number // aguardando cliente
}

function getPeriodDates(period: PeriodType) {
  const now = new Date()
  const todayStart = startOfDay(now)

  let periodStart: Date
  let previousStart: Date
  let previousEnd: Date

  switch (period) {
    case 'today':
      periodStart = todayStart
      previousStart = subDays(todayStart, 1)
      previousEnd = todayStart
      break
    case '7d':
      periodStart = subDays(todayStart, 7)
      previousStart = subDays(todayStart, 14)
      previousEnd = subDays(todayStart, 7)
      break
    case '30d':
      periodStart = subDays(todayStart, 30)
      previousStart = subDays(todayStart, 60)
      previousEnd = subDays(todayStart, 30)
      break
    case '90d':
      periodStart = subDays(todayStart, 90)
      previousStart = subDays(todayStart, 180)
      previousEnd = subDays(todayStart, 90)
      break
    default:
      periodStart = subDays(todayStart, 7)
      previousStart = subDays(todayStart, 14)
      previousEnd = subDays(todayStart, 7)
  }

  return { now, todayStart, periodStart, previousStart, previousEnd }
}

function calculateTrend(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null
  return Math.round(((current - previous) / previous) * 100)
}

export function useDashboardStats(period: PeriodType = '7d') {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { todayStart, periodStart, previousStart, previousEnd } = getPeriodDates(period)

    try {
      // Limitar busca aos últimos 180 dias (máximo necessário para comparações)
      const dataLimit = previousStart.toISOString()

      // Buscar conversas do período relevante (não todas)
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select(`
          id,
          status,
          stage_id,
          created_at,
          resolved_at,
          first_response_at,
          assigned_to,
          assignee:users!assigned_to(id, name, email, avatar_url)
        `)
        .gte('created_at', dataLimit)
        .order('created_at', { ascending: false })
        .limit(1000) // Limite de segurança

      if (convError) throw convError

      // Buscar estágios do kanban
      const { data: stages, error: stagesError } = await supabase
        .from('kanban_stages')
        .select('id, name, slug, color, position, is_final')
        .order('position', { ascending: true })

      if (stagesError) throw stagesError

      // Buscar contatos do período relevante
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, created_at')
        .gte('created_at', dataLimit)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (contactsError) throw contactsError

      // Buscar usuarios ativos (para top agentes) - lista pequena
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, avatar_url')
        .eq('is_active', true)
        .limit(50)

      if (usersError) throw usersError

      // Buscar totais reais (count rápido)
      const [totalConvResult, totalContactsResult] = await Promise.all([
        supabase.from('conversations').select('id', { count: 'exact', head: true }),
        supabase.from('contacts').select('id', { count: 'exact', head: true })
      ])

      const totalConversationsCount = totalConvResult.count || 0
      const totalContactsCount = totalContactsResult.count || 0

      const allConversations = conversations || []
      const allContacts = contacts || []
      const allUsers = users || []

      // ==================
      // METRICAS DE CONVERSAS
      // ==================

      const totalConversations = totalConversationsCount
      const openConversations = allConversations.filter(c => c.status === 'open').length
      const pendingConversations = allConversations.filter(c => c.status === 'pending').length
      const resolvedConversations = allConversations.filter(c => c.status === 'resolved').length

      // Resolvidas no periodo
      const resolvedInPeriod = allConversations.filter(c => {
        if (c.status !== 'resolved' || !c.resolved_at) return false
        const resolvedAt = new Date(c.resolved_at)
        return resolvedAt >= periodStart
      }).length

      // Conversas do periodo atual
      const conversationsInPeriod = allConversations.filter(c => {
        const createdAt = new Date(c.created_at)
        return createdAt >= periodStart
      }).length

      // Conversas do periodo anterior
      const conversationsInPrevious = allConversations.filter(c => {
        const createdAt = new Date(c.created_at)
        return createdAt >= previousStart && createdAt < previousEnd
      }).length

      // ==================
      // METRICAS DE CONTATOS
      // ==================

      const totalContacts = totalContactsCount

      // Novos contatos no periodo
      const newContactsInPeriod = allContacts.filter(c => {
        const createdAt = new Date(c.created_at)
        return createdAt >= periodStart
      }).length

      // Novos contatos no periodo anterior
      const newContactsInPrevious = allContacts.filter(c => {
        const createdAt = new Date(c.created_at)
        return createdAt >= previousStart && createdAt < previousEnd
      }).length

      // ==================
      // PERFORMANCE
      // ==================

      // Tempo medio de resposta (conversas com first_response_at)
      const conversationsWithResponse = allConversations.filter(c =>
        c.first_response_at && c.created_at
      )

      let avgResponseTime: number | null = null
      let avgResponseTimePrevious: number | null = null

      if (conversationsWithResponse.length > 0) {
        const responseTimes = conversationsWithResponse
          .filter(c => new Date(c.created_at) >= periodStart)
          .map(c => differenceInMinutes(new Date(c.first_response_at!), new Date(c.created_at)))
          .filter(t => t >= 0 && t < 1440) // Filtrar outliers (max 24h)

        if (responseTimes.length > 0) {
          avgResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        }

        // Periodo anterior
        const responseTimesPrevious = conversationsWithResponse
          .filter(c => {
            const createdAt = new Date(c.created_at)
            return createdAt >= previousStart && createdAt < previousEnd
          })
          .map(c => differenceInMinutes(new Date(c.first_response_at!), new Date(c.created_at)))
          .filter(t => t >= 0 && t < 1440)

        if (responseTimesPrevious.length > 0) {
          avgResponseTimePrevious = Math.round(responseTimesPrevious.reduce((a, b) => a + b, 0) / responseTimesPrevious.length)
        }
      }

      // Taxa de resolucao
      const resolutionRate = totalConversations > 0
        ? Math.round((resolvedConversations / totalConversations) * 100)
        : 0

      // Taxa de resolucao periodo anterior
      const resolvedInPreviousPeriod = allConversations.filter(c => {
        if (c.status !== 'resolved' || !c.resolved_at) return false
        const resolvedAt = new Date(c.resolved_at)
        return resolvedAt >= previousStart && resolvedAt < previousEnd
      }).length

      const totalInPreviousPeriod = allConversations.filter(c => {
        const createdAt = new Date(c.created_at)
        return createdAt >= previousStart && createdAt < previousEnd
      }).length

      const resolutionRatePrevious = totalInPreviousPeriod > 0
        ? Math.round((resolvedInPreviousPeriod / totalInPreviousPeriod) * 100)
        : 0

      // ==================
      // TRENDS
      // ==================

      const conversationsTrend = calculateTrend(conversationsInPeriod, conversationsInPrevious)
      const contactsTrend = calculateTrend(newContactsInPeriod, newContactsInPrevious)
      const resolutionTrend = calculateTrend(resolutionRate, resolutionRatePrevious)

      // Para tempo de resposta, inverter (menor e melhor)
      let responseTimeTrend: number | null = null
      if (avgResponseTime !== null && avgResponseTimePrevious !== null) {
        responseTimeTrend = calculateTrend(avgResponseTimePrevious, avgResponseTime)
      }

      // ==================
      // GRAFICOS
      // ==================

      // Conversas por dia (ultimos N dias do periodo)
      const daysToShow = period === 'today' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 30
      const conversationsByDay: DailyCount[] = []

      for (let i = daysToShow - 1; i >= 0; i--) {
        const dayStart = startOfDay(subDays(todayStart, i))
        const dayEnd = startOfDay(addDays(dayStart, 1))

        const count = allConversations.filter(c => {
          const createdAt = new Date(c.created_at)
          return createdAt >= dayStart && createdAt < dayEnd
        }).length

        conversationsByDay.push({
          date: format(dayStart, 'yyyy-MM-dd'),
          count
        })
      }

      // Conversas por status
      const statusCounts: Record<string, number> = {}
      allConversations.forEach(c => {
        statusCounts[c.status] = (statusCounts[c.status] || 0) + 1
      })

      const conversationsByStatus: StatusCount[] = Object.entries(statusCounts)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count)

      // ==================
      // TOP AGENTES
      // ==================

      const agentStatsMap: Record<string, AgentStats> = {}

      // Inicializar com usuarios ativos
      allUsers.forEach(user => {
        agentStatsMap[user.id] = {
          id: user.id,
          name: user.name || user.email.split('@')[0],
          email: user.email,
          avatar_url: user.avatar_url,
          conversations: 0,
          resolved: 0,
          avgResponseTime: null
        }
      })

      // Contar conversas por agente (no periodo)
      const conversationsInCurrentPeriod = allConversations.filter(c => {
        const createdAt = new Date(c.created_at)
        return createdAt >= periodStart
      })

      const agentResponseTimes: Record<string, number[]> = {}

      conversationsInCurrentPeriod.forEach(c => {
        if (!c.assigned_to) return

        if (!agentStatsMap[c.assigned_to]) {
          // Agente nao esta na lista de usuarios ativos
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const assigneeData = c.assignee as any
          if (assigneeData) {
            agentStatsMap[c.assigned_to] = {
              id: assigneeData.id,
              name: assigneeData.name || assigneeData.email?.split('@')[0] || 'Usuario',
              email: assigneeData.email || '',
              avatar_url: assigneeData.avatar_url || null,
              conversations: 0,
              resolved: 0,
              avgResponseTime: null
            }
          }
        }

        if (agentStatsMap[c.assigned_to]) {
          agentStatsMap[c.assigned_to].conversations++

          if (c.status === 'resolved') {
            agentStatsMap[c.assigned_to].resolved++
          }

          if (c.first_response_at) {
            const responseTime = differenceInMinutes(new Date(c.first_response_at), new Date(c.created_at))
            if (responseTime >= 0 && responseTime < 1440) {
              if (!agentResponseTimes[c.assigned_to]) {
                agentResponseTimes[c.assigned_to] = []
              }
              agentResponseTimes[c.assigned_to].push(responseTime)
            }
          }
        }
      })

      // Calcular tempo medio por agente
      Object.entries(agentResponseTimes).forEach(([agentId, times]) => {
        if (times.length > 0 && agentStatsMap[agentId]) {
          agentStatsMap[agentId].avgResponseTime = Math.round(
            times.reduce((a, b) => a + b, 0) / times.length
          )
        }
      })

      // Ordenar por conversas e pegar top 5
      const topAgents = Object.values(agentStatsMap)
        .filter(a => a.conversations > 0)
        .sort((a, b) => b.conversations - a.conversations)
        .slice(0, 5)

      // ==================
      // FUNIL DE VENDAS (KANBAN)
      // ==================

      const allStages = stages || []

      // Contar conversas por estágio
      const stageCounts: Record<string, number> = {}
      allConversations.forEach(c => {
        if (c.stage_id) {
          stageCounts[c.stage_id] = (stageCounts[c.stage_id] || 0) + 1
        }
      })

      // Criar array de estágios com contagem
      const totalWithStage = Object.values(stageCounts).reduce((a, b) => a + b, 0)
      const conversationsByStage: StageCount[] = allStages.map(stage => ({
        id: stage.id,
        name: stage.name,
        slug: stage.slug,
        color: stage.color,
        count: stageCounts[stage.id] || 0,
        percentage: totalWithStage > 0
          ? Math.round(((stageCounts[stage.id] || 0) / totalWithStage) * 100)
          : 0,
        isFinal: stage.is_final || false
      }))

      // Encontrar estágios especiais
      const wonStage = allStages.find(s => s.slug === 'fechado-ganho')
      const lostStage = allStages.find(s => s.slug === 'fechado-perdido')
      const waitingStage = allStages.find(s => s.slug === 'aguardando-cliente')

      const wonConversations = wonStage ? (stageCounts[wonStage.id] || 0) : 0
      const lostConversations = lostStage ? (stageCounts[lostStage.id] || 0) : 0
      const waitingConversations = waitingStage ? (stageCounts[waitingStage.id] || 0) : 0

      // Taxa de conversão (ganhos / total que chegou em estágio final)
      const totalFinalStage = wonConversations + lostConversations
      const conversionRate = totalFinalStage > 0
        ? Math.round((wonConversations / totalFinalStage) * 100)
        : 0

      // ==================
      // RESULTADO FINAL
      // ==================

      setStats({
        totalConversations,
        openConversations,
        pendingConversations,
        resolvedConversations,
        resolvedInPeriod,
        totalContacts,
        newContactsInPeriod,
        avgResponseTime,
        resolutionRate,
        conversationsTrend,
        contactsTrend,
        resolutionTrend,
        responseTimeTrend,
        conversationsByDay,
        conversationsByStatus,
        topAgents,
        // Funil de vendas
        conversationsByStage,
        wonConversations,
        lostConversations,
        conversionRate,
        waitingConversations
      })

    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats
  }
}
