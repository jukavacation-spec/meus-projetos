'use client'

export const dynamic = 'force-dynamic'

import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MessageSquare,
  Users,
  Clock,
  TrendingUp,
  CheckCircle2,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Zap,
  RefreshCw,
  Calendar,
  Minus,
  Target,
  XCircle,
  Hourglass
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboardStats, type PeriodType } from '@/hooks/useDashboardStats'
import { useState, memo, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_LABELS: Record<string, string> = {
  open: 'Abertas',
  pending: 'Pendentes',
  resolved: 'Resolvidas',
  snoozed: 'Adiadas',
  archived: 'Arquivadas'
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-yellow-500',
  pending: 'bg-orange-500',
  resolved: 'bg-green-500',
  snoozed: 'bg-blue-500',
  archived: 'bg-gray-500'
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<PeriodType>('7d')
  const { stats, isLoading, refetch } = useDashboardStats(period)

  const periodLabel = {
    today: 'hoje',
    '7d': 'ultimos 7 dias',
    '30d': 'ultimos 30 dias',
    '90d': 'ultimos 90 dias'
  }[period]

  return (
    <>
      <Header title="Dashboard" />

      <div className="p-6 space-y-6">
        {/* Header com filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Visao Geral</h2>
            <p className="text-muted-foreground">
              Acompanhe as metricas do seu atendimento
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
              <SelectTrigger className="w-auto min-w-[180px]">
                <Calendar className="h-4 w-4 mr-2 shrink-0" />
                <SelectValue placeholder="Selecione o periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">Ultimos 7 dias</SelectItem>
                <SelectItem value="30d">Ultimos 30 dias</SelectItem>
                <SelectItem value="90d">Ultimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={refetch} disabled={isLoading} title="Atualizar dados">
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
            </>
          ) : (
            <>
              <MetricCard
                title="Conversas Abertas"
                value={stats?.openConversations || 0}
                description={`${stats?.totalConversations || 0} total`}
                icon={MessageSquare}
                trend={stats?.conversationsTrend}
                trendLabel={`vs. periodo anterior`}
              />
              <MetricCard
                title="Resolvidas"
                value={stats?.resolvedInPeriod || 0}
                description={periodLabel}
                icon={CheckCircle2}
                trend={stats?.resolutionTrend}
                trendLabel="taxa de resolucao"
                iconColor="text-green-500"
              />
              <MetricCard
                title="Tempo Medio"
                value={stats?.avgResponseTime != null ? `${stats.avgResponseTime}min` : '-'}
                description="primeira resposta"
                icon={Clock}
                trend={stats?.responseTimeTrend}
                trendLabel="vs. periodo anterior"
                iconColor="text-blue-500"
                invertTrend
              />
              <MetricCard
                title="Contatos"
                value={stats?.totalContacts || 0}
                description={`+${stats?.newContactsInPeriod || 0} ${periodLabel}`}
                icon={Users}
                trend={stats?.contactsTrend}
                trendLabel="novos contatos"
                iconColor="text-purple-500"
              />
            </>
          )}
        </div>

        {/* Graficos e tabelas */}
        <div className="grid gap-4 lg:grid-cols-7">
          {/* Grafico de conversas por dia */}
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle className="text-lg">Volume de Conversas</CardTitle>
              <CardDescription>Novas conversas por dia</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[200px] flex items-end justify-between gap-2">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="flex-1 h-full" />
                  ))}
                </div>
              ) : stats?.conversationsByDay && stats.conversationsByDay.length > 0 ? (
                <div className="h-[200px] flex items-end justify-between gap-2">
                  {(() => {
                    const last7Days = stats.conversationsByDay.slice(-7)
                    const maxValue = Math.max(...last7Days.map(d => d.count), 1)

                    return last7Days.map((day, i) => {
                      const heightPx = Math.max((day.count / maxValue) * 170, 4) // 170px max (deixa espaco pro label)
                      const date = parseISO(day.date)
                      const dayLabel = format(date, 'EEE', { locale: ptBR })

                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                          <div
                            className="w-full bg-blue-500 rounded-t relative group cursor-pointer transition-all hover:bg-blue-600"
                            style={{ height: `${heightPx}px` }}
                          >
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border">
                              {day.count} conversa{day.count !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground capitalize mt-1">{dayLabel}</span>
                        </div>
                      )
                    })
                  })()}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Nenhuma conversa no periodo
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status das conversas */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">Por Status</CardTitle>
              <CardDescription>Distribuicao de conversas</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ))}
                </div>
              ) : stats?.conversationsByStatus && stats.conversationsByStatus.length > 0 ? (
                <div className="space-y-4">
                  {stats.conversationsByStatus.map(({ status, count }) => {
                    const total = stats.totalConversations || 1
                    const percentage = Math.round((count / total) * 100)

                    return (
                      <div key={status} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{STATUS_LABELS[status] || status}</span>
                          <span className="font-medium">{count} ({percentage}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", STATUS_COLORS[status] || 'bg-gray-500')}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma conversa ainda
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Funil de Vendas */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Distribuicao por Estagio */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Funil de Vendas</CardTitle>
              <CardDescription>Distribuicao por estagio do Kanban</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ))}
                </div>
              ) : stats?.conversationsByStage && stats.conversationsByStage.length > 0 ? (
                <div className="space-y-3">
                  {stats.conversationsByStage.map((stage) => {
                    const maxCount = Math.max(...stats.conversationsByStage.map(s => s.count), 1)
                    const barWidth = Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 8 : 0)

                    return (
                      <div key={stage.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: stage.color }}
                            />
                            <span className={stage.isFinal ? 'font-medium' : ''}>
                              {stage.name}
                            </span>
                          </div>
                          <span className="font-medium tabular-nums">
                            {stage.count} ({stage.percentage}%)
                          </span>
                        </div>
                        <div className="h-6 bg-muted rounded overflow-hidden">
                          <div
                            className="h-full rounded transition-all flex items-center justify-end pr-2"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: stage.color,
                              minWidth: stage.count > 0 ? '32px' : '0'
                            }}
                          >
                            {stage.count > 0 && barWidth > 15 && (
                              <span className="text-xs font-medium text-white">
                                {stage.count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma conversa com estagio definido
                </p>
              )}
            </CardContent>
          </Card>

          {/* Metricas de Conversao */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg shrink-0">
                    <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Taxa de Conversao</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {stats?.conversionRate || 0}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {stats?.wonConversations || 0} vendas
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-100 dark:bg-red-900 rounded-lg shrink-0">
                    <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Nao Convertidas</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {stats?.lostConversations || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {stats?.conversionRate != null ? 100 - stats.conversionRate : 0}% perdidas
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg shrink-0">
                    <Hourglass className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Aguardando Cliente</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <>
                        <p className="text-2xl font-bold">{stats?.waitingConversations || 0}</p>
                        <p className="text-xs text-muted-foreground">
                          conversas em espera
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Top Agentes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance dos Agentes</CardTitle>
            <CardDescription>Ranking de atendimentos no periodo</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.topAgents && stats.topAgents.length > 0 ? (
              <div className="space-y-4">
                {stats.topAgents.map((agent, i) => (
                  <div key={agent.id} className="flex items-center gap-4">
                    <div className={cn(
                      "flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium shrink-0",
                      i === 0 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                      i === 1 ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" :
                      i === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {i + 1}
                    </div>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={agent.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(agent.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{agent.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {agent.conversations} conversa{agent.conversations !== 1 ? 's' : ''}
                        {agent.resolved > 0 && ` • ${agent.resolved} resolvida${agent.resolved !== 1 ? 's' : ''}`}
                        {agent.avgResponseTime !== null && ` • ${agent.avgResponseTime}min tempo medio`}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      <Activity className="h-3 w-3 mr-1" />
                      {Math.round((agent.resolved / Math.max(agent.conversations, 1)) * 100)}% resolucao
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum agente com conversas no periodo
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg shrink-0">
                  <Zap className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Resolucao</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.resolutionRate || 0}%</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg shrink-0">
                  <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Conversas Pendentes</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.pendingConversations || 0}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg shrink-0">
                  <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Novos Contatos</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">+{stats?.newContactsInPeriod || 0}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

// Componente de card de metrica (memoizado para performance)
const MetricCard = memo(function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendLabel,
  iconColor = 'text-primary',
  invertTrend = false
}: {
  title: string
  value: string | number
  description: string
  icon: React.ElementType
  trend?: number | null
  trendLabel?: string
  iconColor?: string
  invertTrend?: boolean
}) {
  // Memoizar cálculos derivados
  const { isPositive, isNegative, displayTrend } = useMemo(() => {
    const isPos = trend !== null && trend !== undefined && (invertTrend ? trend < 0 : trend > 0)
    const isNeg = trend !== null && trend !== undefined && (invertTrend ? trend > 0 : trend < 0)
    const display = trend !== null && trend !== undefined ? Math.abs(trend) : null
    return { isPositive: isPos, isNegative: isNeg, displayTrend: display }
  }, [trend, invertTrend])

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          </div>
          <div className={cn("p-2 rounded-lg bg-muted shrink-0", iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {displayTrend !== null && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            {isPositive && (
              <>
                <ArrowUpRight className="h-3 w-3 text-green-500 shrink-0" />
                <span className="text-green-500">+{displayTrend}%</span>
              </>
            )}
            {isNegative && (
              <>
                <ArrowDownRight className="h-3 w-3 text-red-500 shrink-0" />
                <span className="text-red-500">-{displayTrend}%</span>
              </>
            )}
            {!isPositive && !isNegative && (
              <>
                <Minus className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">0%</span>
              </>
            )}
            <span className="text-muted-foreground ml-1 truncate">{trendLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
})

// Skeleton do card de metrica
function MetricCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        <div className="mt-3">
          <Skeleton className="h-3 w-32" />
        </div>
      </CardContent>
    </Card>
  )
}
