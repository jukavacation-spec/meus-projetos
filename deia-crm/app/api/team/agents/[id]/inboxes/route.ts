import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CHATWOOT_API_URL = process.env.CHATWOOT_API_URL || process.env.CHATWOOT_PLATFORM_URL

/**
 * GET /api/team/agents/[id]/inboxes
 *
 * Lista inboxes atribuídas a um agente
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Buscar company_id do usuário
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json(
        { success: false, error: 'User has no company' },
        { status: 400 }
      )
    }

    // Verificar se o agente pertence à mesma empresa
    const { data: agentData } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('id', agentId)
      .eq('company_id', userData.company_id)
      .single()

    if (!agentData) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Buscar inboxes atribuídas ao agente
    const { data: assignments, error } = await supabase
      .from('agent_inbox_assignments')
      .select('chatwoot_inbox_id')
      .eq('user_id', agentId)

    if (error) {
      console.error('[Agent Inboxes] Error fetching assignments:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch inbox assignments' },
        { status: 500 }
      )
    }

    const inboxIds = assignments?.map(a => a.chatwoot_inbox_id) || []

    return NextResponse.json({
      success: true,
      inboxIds,
    })

  } catch (error) {
    console.error('[Agent Inboxes GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/team/agents/[id]/inboxes
 *
 * Atualiza inboxes de um agente
 * Input: { inboxIds: number[] }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Buscar dados do usuário e empresa
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json(
        { success: false, error: 'User has no company' },
        { status: 400 }
      )
    }

    // Verificar se o agente pertence à mesma empresa
    const { data: agentData } = await supabase
      .from('users')
      .select('id, company_id, chatwoot_agent_id')
      .eq('id', agentId)
      .eq('company_id', userData.company_id)
      .single()

    if (!agentData) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      )
    }

    const { inboxIds } = await request.json()

    if (!Array.isArray(inboxIds)) {
      return NextResponse.json(
        { success: false, error: 'inboxIds must be an array' },
        { status: 400 }
      )
    }

    // Buscar inboxes atuais
    const { data: currentAssignments } = await supabase
      .from('agent_inbox_assignments')
      .select('chatwoot_inbox_id')
      .eq('user_id', agentId)

    const currentInboxIds = currentAssignments?.map(a => a.chatwoot_inbox_id) || []
    const newInboxIds = inboxIds.filter((id: number) => typeof id === 'number')

    // Calcular diferenças
    const toAdd = newInboxIds.filter((id: number) => !currentInboxIds.includes(id))
    const toRemove = currentInboxIds.filter(id => !newInboxIds.includes(id))

    // Buscar credenciais do Chatwoot
    const { data: company } = await supabase
      .from('companies')
      .select('chatwoot_account_id, chatwoot_api_key')
      .eq('id', userData.company_id)
      .single()

    // Sincronizar com Chatwoot se disponível
    if (company?.chatwoot_account_id && company?.chatwoot_api_key && agentData.chatwoot_agent_id && CHATWOOT_API_URL) {
      // Adicionar novas inboxes no Chatwoot
      for (const inboxId of toAdd) {
        try {
          await fetch(
            `${CHATWOOT_API_URL}/api/v1/accounts/${company.chatwoot_account_id}/inboxes/${inboxId}/agents`,
            {
              method: 'POST',
              headers: {
                'api_access_token': company.chatwoot_api_key,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                user_ids: [agentData.chatwoot_agent_id]
              })
            }
          )
        } catch (e) {
          console.error(`[Agent Inboxes] Error adding inbox ${inboxId} in Chatwoot:`, e)
        }
      }

      // Remover inboxes no Chatwoot
      for (const inboxId of toRemove) {
        try {
          await fetch(
            `${CHATWOOT_API_URL}/api/v1/accounts/${company.chatwoot_account_id}/inboxes/${inboxId}/agents/${agentData.chatwoot_agent_id}`,
            {
              method: 'DELETE',
              headers: {
                'api_access_token': company.chatwoot_api_key,
              }
            }
          )
        } catch (e) {
          console.error(`[Agent Inboxes] Error removing inbox ${inboxId} in Chatwoot:`, e)
        }
      }
    }

    // Atualizar no banco de dados
    // Remover atribuições antigas
    if (toRemove.length > 0) {
      await supabase
        .from('agent_inbox_assignments')
        .delete()
        .eq('user_id', agentId)
        .in('chatwoot_inbox_id', toRemove)
    }

    // Adicionar novas atribuições
    if (toAdd.length > 0) {
      const newAssignments = toAdd.map((inboxId: number) => ({
        user_id: agentId,
        chatwoot_inbox_id: inboxId,
        company_id: userData.company_id,
      }))

      await supabase
        .from('agent_inbox_assignments')
        .insert(newAssignments)
    }

    return NextResponse.json({
      success: true,
      inboxIds: newInboxIds,
      added: toAdd,
      removed: toRemove,
    })

  } catch (error) {
    console.error('[Agent Inboxes PUT] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
