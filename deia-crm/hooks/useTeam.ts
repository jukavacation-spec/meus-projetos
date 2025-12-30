'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'

export type Role = {
  id: string
  company_id: string
  name: string
  display_name: string
  permissions: Record<string, Record<string, boolean>>
  is_system: boolean
  created_at: string
}

export type TeamMember = {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  role_id: string | null
  is_active: boolean
  last_seen_at: string | null
  created_at: string
  role?: Role
}

export type TeamInvite = {
  id: string
  company_id: string
  email: string
  role_id: string
  invited_by: string
  token: string
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  expires_at: string
  created_at: string
  inbox_ids?: number[]
  role?: Role
  inviter?: { name: string | null; email: string }
}

export type TeamMemberWithInboxes = TeamMember & {
  inbox_ids?: number[]
  chatwoot_agent_id?: number | null
}

export function useTeam() {
  const { company } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchTeam = useCallback(async () => {
    if (!company?.id) {
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    try {
      // Buscar todos os dados em paralelo para melhor performance
      const [membersResult, invitesResult, rolesResult] = await Promise.all([
        // Buscar membros com role
        supabase
          .from('users')
          .select(`*, role:roles(*)`)
          .eq('company_id', company.id)
          .order('created_at', { ascending: true }),

        // Buscar convites pendentes
        supabase
          .from('team_invites')
          .select(`*, role:roles(*), inviter:users!invited_by(name, email)`)
          .eq('company_id', company.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),

        // Buscar roles via API (bypassa RLS)
        fetch('/api/roles').then(r => r.json())
      ])

      // Processar membros
      if (membersResult.error) throw membersResult.error
      setMembers((membersResult.data || []) as TeamMember[])

      // Processar convites
      if (invitesResult.error) throw invitesResult.error
      setInvites((invitesResult.data || []) as TeamInvite[])

      // Processar roles
      if (!rolesResult.success) {
        throw new Error(rolesResult.error)
      }
      setRoles((rolesResult.roles || []) as Role[])

    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [company?.id])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  const inviteMember = useCallback(async (email: string, roleId: string, inboxIds?: number[]) => {
    if (!company?.id) return { success: false, error: 'Empresa nao encontrada' }

    try {
      // Usar a API que cria o convite e envia o email
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, roleId, inboxIds }),
      })

      const data = await response.json()

      if (!data.success) {
        return { success: false, error: data.error || 'Erro ao enviar convite' }
      }

      setInvites(prev => [data.invite as TeamInvite, ...prev])
      return { success: true, invite: data.invite, inviteUrl: data.inviteUrl }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, [company?.id])

  const cancelInvite = useCallback(async (inviteId: string) => {
    const supabase = createClient()

    try {
      // Deletar convite ao invés de apenas mudar status
      // (evita problemas com constraint unique de company_id, email, status)
      const { error } = await supabase
        .from('team_invites')
        .delete()
        .eq('id', inviteId)

      if (error) throw error

      setInvites(prev => prev.filter(i => i.id !== inviteId))
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, [])

  const resendInvite = useCallback(async (inviteId: string) => {
    try {
      // Usar a API que reenvia o email
      const response = await fetch('/api/team/invite', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      })

      const data = await response.json()

      if (!data.success) {
        return { success: false, error: data.error || 'Erro ao reenviar convite' }
      }

      // Atualizar dados locais
      await fetchTeam()
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, [fetchTeam])

  const updateMemberRole = useCallback(async (memberId: string, roleId: string) => {
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('users')
        .update({ role_id: roleId })
        .eq('id', memberId)

      if (error) throw error

      // Buscar role atualizada
      const { data: roleData } = await supabase
        .from('roles')
        .select('*')
        .eq('id', roleId)
        .single()

      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, role_id: roleId, role: roleData as Role } : m
      ))
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, [])

  const toggleMemberActive = useCallback(async (memberId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/team/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Erro ao atualizar membro' }
      }

      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, is_active: isActive } : m
      ))
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, [])

  const removeMember = useCallback(async (memberId: string) => {
    try {
      const response = await fetch(`/api/team/members/${memberId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Erro ao remover membro' }
      }

      setMembers(prev => prev.filter(m => m.id !== memberId))
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, [])

  const updateMemberInboxes = useCallback(async (memberId: string, inboxIds: number[]) => {
    try {
      const response = await fetch(`/api/team/agents/${memberId}/inboxes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inboxIds }),
      })

      const data = await response.json()

      if (!data.success) {
        return { success: false, error: data.error || 'Erro ao atualizar inboxes' }
      }

      return { success: true, inboxIds: data.inboxIds }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, [])

  const getMemberInboxes = useCallback(async (memberId: string) => {
    try {
      const response = await fetch(`/api/team/agents/${memberId}/inboxes`)
      const data = await response.json()

      if (!data.success) {
        return { success: false, error: data.error, inboxIds: [] }
      }

      return { success: true, inboxIds: data.inboxIds || [] }
    } catch (err) {
      return { success: false, error: (err as Error).message, inboxIds: [] }
    }
  }, [])

  return {
    members,
    invites,
    roles,
    isLoading,
    error,
    inviteMember,
    cancelInvite,
    resendInvite,
    updateMemberRole,
    toggleMemberActive,
    removeMember,
    updateMemberInboxes,
    getMemberInboxes,
    refetch: fetchTeam,
  }
}
