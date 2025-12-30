import { NextRequest, NextResponse } from 'next/server'
import { getCompanyChatwoot, chatwootRequest } from '@/lib/chatwoot/getCompanyChatwoot'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })
}

type RouteParams = {
  params: Promise<{ id: string }>
}

// PATCH - Update conversation (assign, labels, status)
export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const result = await getCompanyChatwoot()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    const { id } = await context.params
    const conversationId = Number(id)
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'assign': {
        const { assigneeId } = data
        // 1. Atribuir no Chatwoot
        await chatwootRequest(
          result.credentials,
          `/conversations/${conversationId}/assignments`,
          {
            method: 'POST',
            body: JSON.stringify({ assignee_id: assigneeId }),
          }
        )

        // 2. Atualizar banco local (buscar user_id pelo chatwoot_agent_id)
        const supabaseAdmin = getSupabaseAdmin()
        const { data: assignedUser } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('company_id', result.companyId)
          .eq('chatwoot_agent_id', assigneeId)
          .single()

        if (assignedUser) {
          await supabaseAdmin
            .from('conversations')
            .update({ assigned_to: assignedUser.id, updated_at: new Date().toISOString() })
            .eq('chatwoot_conversation_id', conversationId)
            .eq('company_id', result.companyId)
        }

        return NextResponse.json({ success: true, message: 'Conversa atribuída com sucesso' })
      }

      case 'unassign': {
        // 1. Desatribuir no Chatwoot
        await chatwootRequest(
          result.credentials,
          `/conversations/${conversationId}/assignments`,
          {
            method: 'POST',
            body: JSON.stringify({ assignee_id: null }),
          }
        )

        // 2. Atualizar banco local
        const supabaseAdminUnassign = getSupabaseAdmin()
        await supabaseAdminUnassign
          .from('conversations')
          .update({ assigned_to: null, updated_at: new Date().toISOString() })
          .eq('chatwoot_conversation_id', conversationId)
          .eq('company_id', result.companyId)

        return NextResponse.json({ success: true, message: 'Atribuição removida com sucesso' })
      }

      case 'labels': {
        const { labels } = data
        await chatwootRequest(
          result.credentials,
          `/conversations/${conversationId}/labels`,
          {
            method: 'POST',
            body: JSON.stringify({ labels }),
          }
        )
        return NextResponse.json({ success: true, message: 'Labels atualizados com sucesso' })
      }

      case 'status': {
        const { status } = data
        await chatwootRequest(
          result.credentials,
          `/conversations/${conversationId}/toggle_status`,
          {
            method: 'POST',
            body: JSON.stringify({ status }),
          }
        )
        return NextResponse.json({ success: true, message: 'Status atualizado com sucesso' })
      }

      case 'markAsRead': {
        await chatwootRequest(
          result.credentials,
          `/conversations/${conversationId}/update_last_seen`,
          { method: 'POST' }
        )
        return NextResponse.json({ success: true, message: 'Conversa marcada como lida' })
      }

      case 'priority': {
        const { priority } = data
        await chatwootRequest(
          result.credentials,
          `/conversations/${conversationId}`,
          {
            method: 'PUT',
            body: JSON.stringify({ priority }),
          }
        )
        return NextResponse.json({ success: true, message: 'Prioridade atualizada com sucesso' })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error updating conversation:', error)
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    )
  }
}

// GET - Get conversation labels
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const result = await getCompanyChatwoot()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    const { id } = await context.params
    const conversationId = Number(id)

    const response = await chatwootRequest<{ payload: string[] }>(
      result.credentials,
      `/conversations/${conversationId}/labels`
    )

    return NextResponse.json({
      labels: response.payload
    })
  } catch (error) {
    console.error('Error fetching conversation labels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch labels' },
      { status: 500 }
    )
  }
}
