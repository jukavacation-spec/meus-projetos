import { createClient } from '@/lib/supabase/server'

export type ChatwootCredentials = {
  accountId: number
  apiKey: string
  baseUrl: string
}

export type GetChatwootResult =
  | { success: true; credentials: ChatwootCredentials; userId: string; companyId: string }
  | { success: false; error: string; status: number }

/**
 * Busca as credenciais do Chatwoot da empresa do usuario logado
 * Retorna erro se usuario nao estiver autenticado ou empresa nao tiver Chatwoot configurado
 */
export async function getCompanyChatwoot(): Promise<GetChatwootResult> {
  const supabase = await createClient()

  // Verificar autenticacao
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Unauthorized', status: 401 }
  }

  // Buscar usuario e empresa
  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!userData?.company_id) {
    return { success: false, error: 'User has no company', status: 400 }
  }

  // Buscar credenciais Chatwoot da empresa
  const { data: company } = await supabase
    .from('companies')
    .select('chatwoot_account_id, chatwoot_api_key')
    .eq('id', userData.company_id)
    .single()

  if (!company?.chatwoot_account_id || !company?.chatwoot_api_key) {
    return { success: false, error: 'Company has no Chatwoot configuration', status: 400 }
  }

  const baseUrl = process.env.CHATWOOT_API_URL || ''

  return {
    success: true,
    credentials: {
      accountId: company.chatwoot_account_id,
      apiKey: company.chatwoot_api_key,
      baseUrl,
    },
    userId: user.id,
    companyId: userData.company_id,
  }
}

/**
 * Helper para fazer requisicoes ao Chatwoot com as credenciais corretas
 */
export async function chatwootRequest<T>(
  credentials: ChatwootCredentials,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${credentials.baseUrl}/api/v1/accounts/${credentials.accountId}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'api_access_token': credentials.apiKey,
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`Chatwoot API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}
