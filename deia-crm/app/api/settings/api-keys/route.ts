import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateApiKey } from '@/lib/api-auth'

/**
 * GET /api/settings/api-keys
 *
 * Lista todas as API Keys da empresa do usuário
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Buscar usuário e verificar se é admin
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role:roles(name)')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json(
        { success: false, error: 'User has no company' },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roleName = (userData.role as any)?.name
    if (!['owner', 'admin'].includes(roleName)) {
      return NextResponse.json(
        { success: false, error: 'Only admins can manage API keys' },
        { status: 403 }
      )
    }

    // Buscar API Keys
    const { data: apiKeys, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, is_active, last_used_at, expires_at, created_at')
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[API Keys] Error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch API keys' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      apiKeys: apiKeys || []
    })

  } catch (error) {
    console.error('[API Keys] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/api-keys
 *
 * Cria uma nova API Key
 *
 * Body:
 *   - name: Nome da chave (ex: "n8n", "Zapier")
 *   - scopes: Array de permissões (opcional, default: todas)
 *   - expires_at: Data de expiração (opcional)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Buscar usuário e verificar se é admin
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role:roles(name)')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json(
        { success: false, error: 'User has no company' },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roleName = (userData.role as any)?.name
    if (!['owner', 'admin'].includes(roleName)) {
      return NextResponse.json(
        { success: false, error: 'Only admins can manage API keys' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, scopes, expires_at } = body

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Name is required (min 2 characters)' },
        { status: 400 }
      )
    }

    // Gerar a chave
    const { key, hash, prefix } = generateApiKey()

    // Inserir no banco
    const { data: apiKey, error } = await supabase
      .from('api_keys')
      .insert({
        company_id: userData.company_id,
        name: name.trim(),
        key_hash: hash,
        key_prefix: prefix,
        scopes: scopes || ['leads:read', 'leads:write', 'messages:send'],
        expires_at: expires_at || null,
        created_by: user.id,
      })
      .select('id, name, key_prefix, scopes, created_at')
      .single()

    if (error) {
      console.error('[API Keys] Error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create API key' },
        { status: 500 }
      )
    }

    // IMPORTANTE: A chave completa só é retornada UMA VEZ
    return NextResponse.json({
      success: true,
      apiKey: {
        ...apiKey,
        key // Chave completa - mostrar apenas uma vez!
      },
      message: 'API Key created. Save this key - it will not be shown again!'
    })

  } catch (error) {
    console.error('[API Keys] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings/api-keys
 *
 * Deleta uma API Key
 *
 * Query: ?id=uuid
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Buscar usuário e verificar se é admin
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role:roles(name)')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json(
        { success: false, error: 'User has no company' },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roleName = (userData.role as any)?.name
    if (!['owner', 'admin'].includes(roleName)) {
      return NextResponse.json(
        { success: false, error: 'Only admins can manage API keys' },
        { status: 403 }
      )
    }

    const keyId = request.nextUrl.searchParams.get('id')
    if (!keyId) {
      return NextResponse.json(
        { success: false, error: 'API Key ID is required' },
        { status: 400 }
      )
    }

    // Deletar (RLS garante que só pode deletar da própria empresa)
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId)
      .eq('company_id', userData.company_id)

    if (error) {
      console.error('[API Keys] Error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete API key' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'API Key deleted'
    })

  } catch (error) {
    console.error('[API Keys] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
