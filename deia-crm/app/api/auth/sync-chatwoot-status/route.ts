import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type StatusType = 'online' | 'offline'

/**
 * POST /api/auth/sync-chatwoot-status
 * Sincroniza o status do agente no Chatwoot com o login/logout do DEIA CRM
 *
 * Body: { status: 'online' | 'offline' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const status: StatusType = body.status

    if (!status || !['online', 'offline'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "online" or "offline"' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Buscar usuário autenticado
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Buscar profile com chatwoot_agent_id e company_id
    const { data: userData } = await supabase
      .from('users')
      .select('chatwoot_agent_id, company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.chatwoot_agent_id || !userData?.company_id) {
      // Usuário não tem agente Chatwoot vinculado - ignorar silenciosamente
      return NextResponse.json({ success: true, synced: false })
    }

    // Buscar credenciais do Chatwoot da empresa
    const { data: company } = await supabase
      .from('companies')
      .select('chatwoot_account_id, chatwoot_api_key')
      .eq('id', userData.company_id)
      .single()

    if (!company?.chatwoot_account_id || !company?.chatwoot_api_key) {
      // Empresa não tem Chatwoot configurado - ignorar silenciosamente
      return NextResponse.json({ success: true, synced: false })
    }

    const baseUrl = process.env.CHATWOOT_API_URL || ''

    // Mapear status para o formato do Chatwoot
    const chatwootStatus = status === 'online' ? 'online' : 'offline'

    // Atualizar status no Chatwoot
    // IMPORTANTE: auto_offline deve ser false para que o status via API funcione
    const chatwootUrl = `${baseUrl}/api/v1/accounts/${company.chatwoot_account_id}/agents/${userData.chatwoot_agent_id}`

    const updateData: Record<string, unknown> = {
      availability: chatwootStatus,
    }

    // Desabilitar auto_offline para permitir controle via API
    if (status === 'online') {
      updateData.auto_offline = false
    }

    const response = await fetch(chatwootUrl, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api_access_token': company.chatwoot_api_key,
      },
      body: JSON.stringify(updateData),
    })

    if (!response.ok) {
      // Log para debug, mas não bloqueia o login/logout
      console.error(`[sync-chatwoot-status] Failed to update Chatwoot: ${response.status}`)
      return NextResponse.json({ success: true, synced: false })
    }

    return NextResponse.json({ success: true, synced: true, status: chatwootStatus })
  } catch (error) {
    // Log para debug, mas retorna sucesso para não bloquear login/logout
    console.error('[sync-chatwoot-status] Error:', error)
    return NextResponse.json({ success: true, synced: false })
  }
}
