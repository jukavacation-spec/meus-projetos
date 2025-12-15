'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
type UserProfile = {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  company_id: string | null
  role_id: string | null
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
}

type UserWithProfile = {
  user: User | null
  profile: UserProfile | null
  role: Role | null
  company: Company | null
  isLoading: boolean
}

export function useAuth(): UserWithProfile {
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
      } catch (error) {
        console.error('Error fetching user:', error)
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

  return { user, profile, role, company, isLoading }
}

export function useSignOut() {
  const supabase = createClient()

  return async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }
}
