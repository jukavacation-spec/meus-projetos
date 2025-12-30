'use client'

import { useState, useCallback } from 'react'

export type UazapiStatus = 'disconnected' | 'connecting' | 'connected' | 'qr_code'

export type UazapiInstanceData = {
  id: string
  name: string
  profileName: string
  profilePicUrl: string
  phoneNumber: string
  platform: string
  isBusiness: boolean
  status: UazapiStatus
  rawStatus: string
  presence: string
  lastDisconnect: string | null
  lastDisconnectReason: string | null
  createdAt: string
}

export type UazapiInstance = {
  instanceName: string
  status: UazapiStatus
  phoneNumber?: string
  qrCode?: string
}

export function useUazapi() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getQRCode = useCallback(async (
    apiUrl: string,
    apiToken: string,
    instanceName?: string
  ): Promise<{ success: boolean; qrCode?: string; error?: string }> => {
    setIsLoading(true)
    setError(null)


    try {
      const response = await fetch('/api/uazapi/qrcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl, apiToken, instanceName }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error)
        return { success: false, error: result.error }
      }

      return { success: true, qrCode: result.qrCode || result.qrCodeDataUrl }
    } catch {
      const errorMsg = 'Erro ao obter QR Code'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getStatus = useCallback(async (
    apiUrl: string,
    apiToken: string,
    instanceName?: string
  ): Promise<{
    success: boolean
    status?: UazapiStatus
    phoneNumber?: string
    instance?: UazapiInstanceData
    error?: string
  }> => {
    setIsLoading(true)
    setError(null)


    try {
      const response = await fetch('/api/uazapi/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl, apiToken, instanceName }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error)
        return { success: false, error: result.error }
      }

      return {
        success: true,
        status: result.status,
        phoneNumber: result.phoneNumber,
        instance: result.instance,
      }
    } catch {
      const errorMsg = 'Erro ao verificar status'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const disconnectInstance = useCallback(async (
    apiUrl: string,
    apiToken: string,
    instanceName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/uazapi/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl, apiToken, instanceName }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error)
        return { success: false, error: result.error }
      }

      return { success: true }
    } catch {
      const errorMsg = 'Erro ao desconectar instancia'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const sendMessage = useCallback(async (
    apiUrl: string,
    apiToken: string,
    to: string,
    message: string,
    options?: {
      mediaUrl?: string
      mediaType?: 'image' | 'document' | 'audio' | 'video'
      fileName?: string
      caption?: string
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    setError(null)


    try {
      const response = await fetch('/api/uazapi/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiUrl,
          apiToken,
          to,
          message,
          ...options,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error)
        return { success: false, error: result.error }
      }

      return { success: true, messageId: result.messageId }
    } catch {
      const errorMsg = 'Erro ao enviar mensagem'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    }
  }, [])

  return {
    isLoading,
    error,
    getQRCode,
    getStatus,
    disconnectInstance,
    sendMessage,
  }
}
