'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'

const INACTIVITY_TIMEOUT = 10 * 60 * 1000 // 10 minutos

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline'

export type UserPresence = {
  id: string
  user_id: string
  company_id: string
  status: PresenceStatus
  status_text: string | null
  last_seen_at: string
  updated_at: string
}

export type TeamMemberWithPresence = {
  id: string
  name: string | null
  email: string
  avatar_url: string | null
  role: {
    id: string
    name: string
    display_name: string
  } | null
  presence: UserPresence | null
}

const HEARTBEAT_INTERVAL = 30000 // 30 seconds
const OFFLINE_TIMEOUT = 120000 // 2 minutes after page hidden

export function useTeamPresence() {
  const { user, company, profile } = useAuth()
  const [teamPresence, setTeamPresence] = useState<Map<string, UserPresence>>(new Map())
  const [myPresence, setMyPresence] = useState<UserPresence | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const offlineTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousStatusRef = useRef<PresenceStatus | null>(null)
  const inactivityStatusRef = useRef<'busy' | 'offline'>('busy')
  const autoAwayEnabledRef = useRef<boolean>(true)

  // Fetch all presence data for company
  const fetchPresence = useCallback(async () => {
    if (!user || !company) return

    const supabase = createClient()

    try {
      const { data, error: fetchError } = await supabase
        .from('user_presence')
        .select('*')
        .eq('company_id', company.id)

      if (fetchError) throw fetchError

      const presenceMap = new Map<string, UserPresence>()
      data?.forEach(p => {
        presenceMap.set(p.user_id, p)
        if (p.user_id === user.id) {
          setMyPresence(p)
        }
      })
      setTeamPresence(presenceMap)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [user, company])

  // Sync status with Chatwoot
  const syncChatwootStatus = useCallback(async (status: PresenceStatus) => {
    if (!profile?.chatwoot_agent_id) return

    try {
      await fetch(`/api/chatwoot/agents/${profile.chatwoot_agent_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability_status: status }),
      })
    } catch {
      // Silently fail - Chatwoot sync is secondary
    }
  }, [profile?.chatwoot_agent_id])

  // Update my presence status
  const updateMyPresence = useCallback(async (
    status: PresenceStatus,
    statusText?: string | null,
    syncToChatwoot: boolean = true
  ) => {
    if (!user || !company) return

    const supabase = createClient()

    try {
      const presenceData = {
        user_id: user.id,
        company_id: company.id,
        status,
        status_text: statusText ?? null,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Upsert presence
      const { data, error: upsertError } = await supabase
        .from('user_presence')
        .upsert(presenceData, { onConflict: 'user_id' })
        .select()
        .single()

      if (upsertError) throw upsertError

      setMyPresence(data)
      setTeamPresence(prev => {
        const newMap = new Map(prev)
        newMap.set(user.id, data)
        return newMap
      })

      // Sync with Chatwoot
      if (syncToChatwoot) {
        syncChatwootStatus(status)
      }

      return data
    } catch (err) {
      setError(err as Error)
    }
  }, [user, company, syncChatwootStatus])

  // Send heartbeat
  const sendHeartbeat = useCallback(async () => {
    if (!user || !company) return

    const supabase = createClient()

    try {
      const { error: updateError } = await supabase
        .from('user_presence')
        .update({
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      if (updateError) {
        // If no presence exists, create one as online
        await updateMyPresence('online')
      }
    } catch {
    }
  }, [user, company, updateMyPresence])

  // Set offline status
  const goOffline = useCallback(async () => {
    if (!user) return

    const supabase = createClient()

    try {
      await supabase
        .from('user_presence')
        .update({
          status: 'offline',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      // Sync offline status with Chatwoot
      syncChatwootStatus('offline')
    } catch {
    }
  }, [user, syncChatwootStatus])

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) return

    heartbeatRef.current = setInterval(() => {
      sendHeartbeat()
    }, HEARTBEAT_INTERVAL)
  }, [sendHeartbeat])

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  // Handle visibility change
  useEffect(() => {
    if (!user) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden - start offline timeout
        offlineTimeoutRef.current = setTimeout(() => {
          goOffline()
          stopHeartbeat()
        }, OFFLINE_TIMEOUT)
      } else {
        // Page is visible - cancel offline timeout and restart heartbeat
        if (offlineTimeoutRef.current) {
          clearTimeout(offlineTimeoutRef.current)
          offlineTimeoutRef.current = null
        }

        // If was offline, go online
        if (myPresence?.status === 'offline') {
          updateMyPresence('online')
        }

        startHeartbeat()
        sendHeartbeat()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, myPresence, goOffline, stopHeartbeat, startHeartbeat, sendHeartbeat, updateMyPresence])

  // Handle page close
  useEffect(() => {
    if (!user) return

    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline status
      navigator.sendBeacon?.(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${user.id}`,
        JSON.stringify({ status: 'offline', updated_at: new Date().toISOString() })
      )
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [user])

  // Setup realtime subscription and initial presence
  useEffect(() => {
    if (!user || !company) return

    // Initial fetch
    fetchPresence()

    // Set initial online status
    updateMyPresence('online')

    // Start heartbeat
    startHeartbeat()
    sendHeartbeat()

    // Setup realtime subscription
    const supabase = createClient()

    const channel = supabase
      .channel(`presence-${company.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
          filter: `company_id=eq.${company.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const presence = payload.new as UserPresence
            setTeamPresence(prev => {
              const newMap = new Map(prev)
              newMap.set(presence.user_id, presence)
              return newMap
            })

            if (presence.user_id === user.id) {
              setMyPresence(presence)
            }
          } else if (payload.eventType === 'DELETE') {
            const presence = payload.old as UserPresence
            setTeamPresence(prev => {
              const newMap = new Map(prev)
              newMap.delete(presence.user_id)
              return newMap
            })
          }
        }
      )
      .subscribe()

    return () => {
      stopHeartbeat()
      supabase.removeChannel(channel)

      // Clear timeouts
      if (offlineTimeoutRef.current) {
        clearTimeout(offlineTimeoutRef.current)
      }
    }
  }, [user, company, fetchPresence, updateMyPresence, startHeartbeat, stopHeartbeat, sendHeartbeat])

  // Funcao para definir status de inatividade (chamada de fora)
  const setInactivityStatus = useCallback((status: 'busy' | 'offline') => {
    inactivityStatusRef.current = status
  }, [])

  // Funcao para habilitar/desabilitar auto-away (chamada de fora)
  const setAutoAwayEnabled = useCallback((enabled: boolean) => {
    autoAwayEnabledRef.current = enabled
  }, [])

  // Auto-away por inatividade
  useEffect(() => {
    if (!user) return

    // Handler para atividade do usuario (restaura online se estava auto-away)
    const handleUserActivity = () => {
      // Se estava no status de inatividade automatica, voltar para online
      if ((myPresence?.status === 'busy' || myPresence?.status === 'offline') && previousStatusRef.current === 'online') {
        updateMyPresence('online')
        previousStatusRef.current = null
      }

      // Reiniciar timer de inatividade
      startInactivityTimer()
    }

    // Iniciar timer de inatividade
    const startInactivityTimer = () => {
      // Limpar timer anterior
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current)
      }

      // So iniciar timer se auto-away estiver habilitado
      if (!autoAwayEnabledRef.current) return

      // Iniciar novo timer de inatividade
      inactivityTimeoutRef.current = setTimeout(() => {
        // Verificar novamente se ainda esta habilitado
        if (!autoAwayEnabledRef.current) return

        // So mudar se estiver online (nao sobrescrever status manual)
        if (myPresence?.status === 'online') {
          previousStatusRef.current = 'online'
          updateMyPresence(inactivityStatusRef.current)
        }
      }, INACTIVITY_TIMEOUT)
    }

    // Eventos de atividade
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']

    // Adicionar listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true })
    })

    // Iniciar timer (sem restaurar status - isso so acontece com atividade real)
    startInactivityTimer()

    return () => {
      // Remover listeners
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleUserActivity)
      })

      // Limpar timer
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current)
      }
    }
  }, [user, myPresence?.status, updateMyPresence])

  // Helper to get presence for a specific user
  const getPresence = useCallback((userId: string): UserPresence | null => {
    return teamPresence.get(userId) || null
  }, [teamPresence])

  // Helper to get status color
  const getStatusColor = useCallback((status: PresenceStatus): string => {
    switch (status) {
      case 'online':
        return 'bg-green-500'
      case 'busy':
      case 'away': // away mapeia para busy no Chatwoot
        return 'bg-yellow-500'
      case 'offline':
      default:
        return 'bg-gray-400'
    }
  }, [])

  // Helper to get status label
  const getStatusLabel = useCallback((status: PresenceStatus): string => {
    switch (status) {
      case 'online':
        return 'Online'
      case 'busy':
      case 'away': // away mapeia para busy no Chatwoot
        return 'Ocupado'
      case 'offline':
      default:
        return 'Offline'
    }
  }, [])

  return {
    teamPresence: Array.from(teamPresence.values()),
    myPresence,
    isLoading,
    error,
    updateMyPresence,
    goOffline,
    getPresence,
    getStatusColor,
    getStatusLabel,
    refetch: fetchPresence,
    syncChatwootStatus,
    setInactivityStatus,
    setAutoAwayEnabled,
  }
}

// Format last seen time
export function formatLastSeen(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Agora'
  if (diffMins < 60) return `${diffMins} min atras`
  if (diffHours < 24) return `${diffHours}h atras`
  if (diffDays < 7) return `${diffDays} dias atras`

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
