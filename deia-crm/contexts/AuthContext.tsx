'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type UserProfile = {
  id: string
  email: string
  name: string | null
  display_name: string | null
  avatar_url: string | null
  company_id: string | null
  role_id: string | null
  chatwoot_agent_id: number | null
}

type Role = {
  id: string
  name: string
  display_name: string
  permissions: Record<string, unknown>
}

type Company = {
  id: string
  name: string
  slug: string
  plan: string
  additional_instances: number
}

type AuthContextType = {
  user: User | null
  profile: UserProfile | null
  role: Role | null
  company: Company | null
  isLoading: boolean
  signOut: () => Promise<void>
  hasPermission: (resource: string, action: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function getUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        if (user) {
          // Buscar perfil do usuario com role e company
          const { data: profileData } = await supabase
            .from('users')
            .select(`
              *,
              role:roles(*),
              company:companies(*)
            `)
            .eq('id', user.id)
            .single()

          if (profileData) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = profileData as any
            setProfile(data)
            setRole(data.role as Role)
            setCompany(data.company as Company)
          }
        }
      } catch {
        // Error handled silently
      } finally {
        setIsLoading(false)
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (!session?.user) {
          setProfile(null)
          setRole(null)
          setCompany(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    // Sincronizar status com Chatwoot antes do logout
    try {
      await fetch('/api/auth/sync-chatwoot-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'offline' })
      })
    } catch {
      // Ignorar erros - não bloquear logout
    }

    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Verificar permissao do usuario
  // Exemplo: hasPermission('settings', 'read') ou hasPermission('kanban', 'configure')
  const hasPermission = useCallback((resource: string, action: string): boolean => {
    if (!role?.permissions) return false

    const resourcePermissions = role.permissions[resource] as Record<string, boolean> | undefined
    if (!resourcePermissions) return false

    return resourcePermissions[action] === true
  }, [role])

  // Memoizar o valor do contexto para evitar re-renders desnecessários
  const value = useMemo(() => ({
    user,
    profile,
    role,
    company,
    isLoading,
    signOut,
    hasPermission
  }), [user, profile, role, company, isLoading, hasPermission])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}
