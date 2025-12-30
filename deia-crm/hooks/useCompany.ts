'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'

export type CompanySettings = {
  logo_url?: string
  timezone?: string
  support_email?: string
  support_phone?: string
  // UAZAPI integration
  uazapi_api_url?: string
  uazapi_api_token?: string
  uazapi_instance_name?: string
  uazapi_chatwoot_inbox_id?: number
}

export type Company = {
  id: string
  name: string
  slug: string
  chatwoot_account_id: number | null
  chatwoot_api_key: string | null
  plan: string
  settings: CompanySettings
  created_at: string
  updated_at: string
}

type UpdateCompanyData = {
  name?: string
  slug?: string
  chatwoot_account_id?: number | null
  chatwoot_api_key?: string | null
  settings?: CompanySettings
}

export function useCompany() {
  const { company: authCompany } = useAuth()
  const [company, setCompany] = useState<Company | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const fetchCompany = useCallback(async () => {
    if (!authCompany?.id) {
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', authCompany.id)
        .single()

      if (error) throw error
      setCompany(data as Company)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [authCompany?.id])

  useEffect(() => {
    fetchCompany()
  }, [fetchCompany])

  const updateCompany = useCallback(async (data: UpdateCompanyData) => {
    if (!company?.id) return

    const supabase = createClient()
    setIsSaving(true)

    try {
      const updateData = {
        ...data,
        updated_at: new Date().toISOString(),
      }

      // Se estiver atualizando settings, fazer merge com existente
      if (data.settings) {
        updateData.settings = {
          ...company.settings,
          ...data.settings,
        }
      }

      const { data: updated, error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', company.id)
        .select()
        .single()

      if (error) throw error
      setCompany(updated as Company)
      return { success: true }
    } catch (err) {
      setError(err as Error)
      return { success: false, error: err }
    } finally {
      setIsSaving(false)
    }
  }, [company])

  const testChatwootConnection = useCallback(async (accountId: number, apiKey: string) => {
    try {
      const response = await fetch('/api/chatwoot/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, apiKey }),
      })

      const result = await response.json()
      return result
    } catch {
      return { success: false, error: 'Erro ao conectar com Chatwoot' }
    }
  }, [])

  return {
    company,
    isLoading,
    error,
    isSaving,
    updateCompany,
    testChatwootConnection,
    refetch: fetchCompany,
  }
}
