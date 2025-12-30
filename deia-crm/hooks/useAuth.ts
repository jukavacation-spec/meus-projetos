'use client'

import { useAuthContext } from '@/contexts/AuthContext'

// Re-exportar tipos para compatibilidade
export type UserProfile = {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  company_id: string | null
  role_id: string | null
  chatwoot_agent_id: number | null
}

export type Role = {
  id: string
  name: string
  display_name: string
  permissions: Record<string, unknown>
}

export type Company = {
  id: string
  name: string
  slug: string
  plan: string
  additional_instances: number
}

// Hook que usa o contexto compartilhado (evita múltiplas subscriptions)
export function useAuth() {
  const { user, profile, role, company, isLoading, hasPermission } = useAuthContext()
  return { user, profile, role, company, isLoading, hasPermission }
}

export function useSignOut() {
  const { signOut } = useAuthContext()
  return signOut
}
