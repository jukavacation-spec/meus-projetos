'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export type InstanceStatus = 'pending' | 'qr_ready' | 'connecting' | 'connected' | 'disconnected' | 'error'

export type Instance = {
  id: string
  company_id: string
  name: string
  uazapi_instance_name: string
  uazapi_token: string | null
  uazapi_status: InstanceStatus
  whatsapp_number: string | null
  whatsapp_profile_name: string | null
  whatsapp_profile_pic_url: string | null
  whatsapp_is_business: boolean
  whatsapp_platform: string | null
  chatwoot_inbox_id: number | null
  chatwoot_inbox_name: string | null
  connected_at: string | null
  disconnected_at: string | null
  created_at: string
  updated_at: string
}

export function useInstances() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Fetch all instances
  const fetchInstances = useCallback(async () => {
    try {
      const response = await fetch('/api/integracoes/whatsapp')
      const data = await response.json()

      if (data.success) {
        setInstances(data.instances || [])
      } else {
        setError(data.error)
      }
    } catch {
      setError('Failed to fetch instances')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Create new instance
  const createInstance = useCallback(async (name: string): Promise<{
    success: boolean
    instance?: Instance
    error?: string
  }> => {
    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/integracoes/whatsapp/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: name }),
      })

      const data = await response.json()

      if (data.success && data.instance) {
        // Refetch para pegar dados completos
        await fetchInstances()
        return { success: true, instance: data.instance }
      } else {
        setError(data.error)
        return { success: false, error: data.error }
      }
    } catch {
      const errorMsg = 'Failed to create instance'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setIsCreating(false)
    }
  }, [fetchInstances])

  // Get QR Code for instance
  const getQRCode = useCallback(async (instanceId: string): Promise<{
    success: boolean
    qrCode?: string
    status?: string
    error?: string
  }> => {
    try {
      const response = await fetch(`/api/integracoes/whatsapp/qr?instanceId=${instanceId}`)
      const data = await response.json()

      if (data.success) {
        return {
          success: true,
          qrCode: data.qrCodeDataUrl || data.qrCode,
          status: data.status,
        }
      } else {
        return { success: false, error: data.error, status: data.status }
      }
    } catch {
      return { success: false, error: 'Failed to get QR code' }
    }
  }, [])

  // Check instance status
  const checkStatus = useCallback(async (instanceId: string): Promise<{
    success: boolean
    status?: InstanceStatus
    instance?: Instance
    error?: string
  }> => {
    try {
      const response = await fetch(`/api/integracoes/whatsapp/status?instanceId=${instanceId}`)
      const data = await response.json()

      if (data.success) {
        // Atualizar instancia local
        setInstances(prev =>
          prev.map(inst =>
            inst.id === instanceId
              ? { ...inst, ...data.instance }
              : inst
          )
        )

        return {
          success: true,
          status: data.status as InstanceStatus,
          instance: data.instance,
        }
      } else {
        return { success: false, error: data.error }
      }
    } catch {
      return { success: false, error: 'Failed to check status' }
    }
  }, [])

  // Delete instance
  const deleteInstance = useCallback(async (instanceId: string): Promise<{
    success: boolean
    error?: string
  }> => {
    try {
      const response = await fetch(`/api/integracoes/whatsapp/${instanceId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        // Remover da lista local imediatamente
        setInstances(prev => prev.filter(inst => inst.id !== instanceId))
        // Forcar refetch para garantir sincronizacao com backend
        await fetchInstances()
        return { success: true }
      } else {
        return { success: false, error: data.error }
      }
    } catch {
      return { success: false, error: 'Failed to delete instance' }
    }
  }, [fetchInstances])

  // Reconnect instance
  const reconnectInstance = useCallback(async (instanceId: string): Promise<{
    success: boolean
    error?: string
  }> => {
    try {
      const response = await fetch(`/api/integracoes/whatsapp/${instanceId}?action=reconnect`, {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        // Atualizar status local
        setInstances(prev =>
          prev.map(inst =>
            inst.id === instanceId
              ? { ...inst, uazapi_status: 'pending' as InstanceStatus }
              : inst
          )
        )
        return { success: true }
      } else {
        return { success: false, error: data.error }
      }
    } catch {
      return { success: false, error: 'Failed to reconnect instance' }
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchInstances()
  }, [fetchInstances])

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('instances-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'instances',
        },
        () => {
          // Refetch on any change
          fetchInstances()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchInstances])

  return {
    instances,
    isLoading,
    isCreating,
    error,
    createInstance,
    getQRCode,
    checkStatus,
    deleteInstance,
    reconnectInstance,
    refetch: fetchInstances,
  }
}

// Hook para polling de status de uma instancia especifica
export function useInstanceStatusPolling(
  instanceId: string | null,
  enabled: boolean = true,
  interval: number = 5000 // Aumentado de 3s para 5s
) {
  const [status, setStatus] = useState<InstanceStatus | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [instance, setInstance] = useState<Instance | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const attemptRef = useRef(0)

  useEffect(() => {
    if (!instanceId || !enabled) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      attemptRef.current = 0
      return
    }

    const checkStatus = async () => {
      try {
        // Buscar QR code primeiro (isso também verifica status)
        const qrResponse = await fetch(`/api/integracoes/whatsapp/qr?instanceId=${instanceId}`)
        const qrData = await qrResponse.json()

        if (qrData.success && qrData.qrCodeDataUrl) {
          setQrCode(qrData.qrCodeDataUrl)
          setStatus('qr_ready')
          attemptRef.current = 0 // Reset attempts quando tem QR
          return
        }

        // Se QR retornou status conectado, parar polling
        if (qrData.status === 'connected') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          setQrCode(null)
          setStatus('connected')

          // Buscar dados atualizados da instância
          const statusResponse = await fetch(`/api/integracoes/whatsapp/status?instanceId=${instanceId}`)
          const statusData = await statusResponse.json()
          if (statusData.success) {
            setInstance(statusData.instance)
          }
          return
        }

        // Se ainda não tem QR, atualizar status
        if (qrData.status) {
          setStatus(qrData.status as InstanceStatus)
        }

        // Exponential backoff após muitas tentativas (max 30s)
        attemptRef.current++
        if (attemptRef.current > 10 && pollingRef.current) {
          clearInterval(pollingRef.current)
          const backoffInterval = Math.min(interval * 2, 30000)
          pollingRef.current = setInterval(checkStatus, backoffInterval)
        }
      } catch {
      }
    }

    // Check immediately
    checkStatus()

    // Start polling
    pollingRef.current = setInterval(checkStatus, interval)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      attemptRef.current = 0
    }
  }, [instanceId, enabled, interval])

  return { status, qrCode, instance }
}
