import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export type ApiKeyData = {
  id: string
  companyId: string
  name: string
  scopes: string[]
}

export type ApiAuthResult =
  | { success: true; apiKey: ApiKeyData }
  | { success: false; error: string; status: number }

/**
 * Gera uma nova API Key
 * Formato: deia_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (40 caracteres total)
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomBytes = crypto.randomBytes(24).toString('hex')
  const key = `deia_${randomBytes}`
  const hash = crypto.createHash('sha256').update(key).digest('hex')
  const prefix = key.substring(0, 12) // "deia_XXXXXXX"

  return { key, hash, prefix }
}

/**
 * Valida uma API Key e retorna os dados associados
 * Header esperado: Authorization: Bearer deia_XXXXX ou X-API-Key: deia_XXXXX
 */
export async function validateApiKey(request: NextRequest): Promise<ApiAuthResult> {
  // Extrair API Key do header
  const authHeader = request.headers.get('authorization')
  const apiKeyHeader = request.headers.get('x-api-key')

  let apiKey: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    apiKey = authHeader.substring(7)
  } else if (apiKeyHeader) {
    apiKey = apiKeyHeader
  }

  if (!apiKey) {
    return {
      success: false,
      error: 'API Key not provided. Use Authorization: Bearer <key> or X-API-Key: <key>',
      status: 401
    }
  }

  // Verificar formato
  if (!apiKey.startsWith('deia_')) {
    return {
      success: false,
      error: 'Invalid API Key format',
      status: 401
    }
  }

  // Hash da chave para buscar no banco
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })

  // Buscar API Key no banco
  const { data: keyData, error } = await supabase
    .from('api_keys')
    .select('id, company_id, name, scopes, is_active, expires_at')
    .eq('key_hash', keyHash)
    .single()

  if (error || !keyData) {
    return {
      success: false,
      error: 'Invalid API Key',
      status: 401
    }
  }

  // Verificar se está ativa
  if (!keyData.is_active) {
    return {
      success: false,
      error: 'API Key is disabled',
      status: 401
    }
  }

  // Verificar expiração
  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    return {
      success: false,
      error: 'API Key has expired',
      status: 401
    }
  }

  // Atualizar last_used_at (fire and forget)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyData.id)
    .then(() => {})

  return {
    success: true,
    apiKey: {
      id: keyData.id,
      companyId: keyData.company_id,
      name: keyData.name,
      scopes: keyData.scopes || []
    }
  }
}

/**
 * Verifica se a API Key tem um scope específico
 */
export function hasScope(apiKey: ApiKeyData, scope: string): boolean {
  return apiKey.scopes.includes(scope) || apiKey.scopes.includes('*')
}

/**
 * Helper para retornar erro de autenticação
 */
export function unauthorizedResponse(message: string, status: number = 401): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  )
}

/**
 * Helper para retornar erro de permissão
 */
export function forbiddenResponse(scope: string): NextResponse {
  return NextResponse.json(
    { success: false, error: `Missing required scope: ${scope}` },
    { status: 403 }
  )
}
