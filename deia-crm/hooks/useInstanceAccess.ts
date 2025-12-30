'use client'

import { useState, useCallback } from 'react'

interface UserWithRole {
  id: string
  name: string | null
  email: string
  avatar_url: string | null
  role: {
    name: string
    display_name: string
  } | null
}

interface MemberWithAccess extends UserWithRole {
  hasAccess: boolean
  isAdminOrOwner: boolean
  canToggle: boolean
}

interface InstanceAccessData {
  instance: {
    id: string
    name: string
  }
  accessList: Array<{
    id: string
    user_id: string
    created_at: string
    user: UserWithRole
  }>
  members: MemberWithAccess[]
  canManage: boolean
}

export function useInstanceAccess(instanceId: string | null) {
  const [data, setData] = useState<InstanceAccessData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAccess = useCallback(async () => {
    if (!instanceId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/integracoes/whatsapp/${instanceId}/access`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Erro ao carregar acessos')
      }

      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [instanceId])

  const grantAccess = useCallback(async (userId: string) => {
    if (!instanceId) return false

    try {
      const response = await fetch(`/api/integracoes/whatsapp/${instanceId}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Erro ao conceder acesso')
      }

      // Atualiza a lista local
      await fetchAccess()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      return false
    }
  }, [instanceId, fetchAccess])

  const revokeAccess = useCallback(async (userId: string) => {
    if (!instanceId) return false

    try {
      const response = await fetch(`/api/integracoes/whatsapp/${instanceId}/access?userId=${userId}`, {
        method: 'DELETE',
      })
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Erro ao revogar acesso')
      }

      // Atualiza a lista local
      await fetchAccess()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      return false
    }
  }, [instanceId, fetchAccess])

  const toggleAccess = useCallback(async (userId: string, currentHasAccess: boolean) => {
    if (currentHasAccess) {
      return revokeAccess(userId)
    } else {
      return grantAccess(userId)
    }
  }, [grantAccess, revokeAccess])

  return {
    data,
    loading,
    error,
    fetchAccess,
    grantAccess,
    revokeAccess,
    toggleAccess,
    members: data?.members || [],
    canManage: data?.canManage || false,
    instanceName: data?.instance?.name || '',
  }
}
