import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabaseAdmin() {
  return createAdminClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })
}

type ChatwootConversation = {
  id: number
  status: string
  meta?: {
    assignee?: {
      id: number
      name?: string
    }
  }
}

type ChatwootResponse = {
  data: {
    payload: ChatwootConversation[]
    meta?: {
      count?: number
    }
  }
}

/**
 * POST /api/chatwoot/sync-assignments
 * Sincroniza as atribuições de conversas do Chatwoot para o DEIA CRM
 *
 * Busca todas as conversas abertas no Chatwoot e atualiza o campo assigned_to
 * no banco de dados local com base no chatwoot_agent_id do assignee.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const supabaseAdmin = getSupabaseAdmin()

    // Verificar usuário autenticado
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Buscar empresa do usuário
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Buscar credenciais do Chatwoot da empresa (incluindo URL)
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('chatwoot_account_id, chatwoot_api_key, chatwoot_url')
      .eq('id', userData.company_id)
      .single()

    if (!company?.chatwoot_account_id || !company?.chatwoot_api_key) {
      return NextResponse.json({ error: 'Chatwoot not configured' }, { status: 400 })
    }

    // Usar URL do banco ou fallback para URL padrão
    const chatwootUrl = company.chatwoot_url || process.env.CHATWOOT_API_URL || 'https://desk.faltechia.com'

    console.log('[sync-assignments] Using Chatwoot URL:', chatwootUrl)
    let totalUpdated = 0
    let page = 1
    const perPage = 25

    // Paginar todas as conversas abertas
    while (true) {
      const response = await fetch(
        `${chatwootUrl}/api/v1/accounts/${company.chatwoot_account_id}/conversations?status=open&page=${page}&per_page=${perPage}`,
        {
          headers: {
            'Accept': 'application/json',
            'api_access_token': company.chatwoot_api_key,
          },
        }
      )

      if (!response.ok) {
        console.error('[sync-assignments] Chatwoot API error:', response.status)
        break
      }

      const data = await response.json() as ChatwootResponse['data']
      const conversations = data.payload || []

      if (conversations.length === 0) break

      // Mapear status do Chatwoot para o formato do banco
      const statusMap: Record<string, string> = {
        'open': 'open',
        'pending': 'open',    // pending = aguardando, ainda é aberta
        'resolved': 'resolved',
        'snoozed': 'open'     // snoozed = adiada, ainda é aberta
      }

      // Processar cada conversa
      for (const conv of conversations) {
        const assigneeAgentId = conv.meta?.assignee?.id

        // Buscar user_id pelo chatwoot_agent_id
        let newAssignedTo: string | null = null

        if (assigneeAgentId) {
          const { data: assignedUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('company_id', userData.company_id)
            .eq('chatwoot_agent_id', assigneeAgentId)
            .single()

          newAssignedTo = assignedUser?.id || null
        }

        // Mapear status do Chatwoot
        const dbStatus = statusMap[conv.status] || 'open'

        // Atualizar no banco (assigned_to E status)
        const { data: updated, error } = await supabaseAdmin
          .from('conversations')
          .update({
            assigned_to: newAssignedTo,
            status: dbStatus,
            updated_at: new Date().toISOString()
          })
          .eq('chatwoot_conversation_id', conv.id)
          .eq('company_id', userData.company_id)
          .select('id')

        if (!error && updated && updated.length > 0) {
          totalUpdated++
        }
      }

      // Se retornou menos que perPage, não há mais páginas
      if (conversations.length < perPage) break
      page++
    }

    return NextResponse.json({
      success: true,
      updated: totalUpdated,
      message: `${totalUpdated} conversas sincronizadas`
    })
  } catch (error) {
    console.error('[sync-assignments] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
