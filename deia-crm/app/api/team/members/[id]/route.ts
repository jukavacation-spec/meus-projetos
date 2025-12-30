import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const CHATWOOT_API_URL = process.env.CHATWOOT_API_URL || process.env.CHATWOOT_PLATFORM_URL

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * DELETE /api/team/members/[id]
 *
 * Remove um membro da equipe
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Buscar dados do usuário atual
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('company_id, role_id')
      .eq('id', user.id)
      .single()

    if (!currentUser?.company_id) {
      return NextResponse.json(
        { success: false, error: 'User has no company' },
        { status: 400 }
      )
    }

    // Verificar se o usuário atual é admin/owner
    const { data: currentRole } = await supabaseAdmin
      .from('roles')
      .select('name')
      .eq('id', currentUser.role_id)
      .single()

    if (currentRole?.name !== 'owner' && currentRole?.name !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Apenas administradores podem remover membros' },
        { status: 403 }
      )
    }

    // Buscar o membro a ser removido
    const { data: member } = await supabaseAdmin
      .from('users')
      .select('id, name, email, company_id, chatwoot_agent_id')
      .eq('id', memberId)
      .eq('company_id', currentUser.company_id)
      .single()

    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Membro não encontrado' },
        { status: 404 }
      )
    }

    // Não permitir remover a si mesmo
    if (member.id === user.id) {
      return NextResponse.json(
        { success: false, error: 'Você não pode remover a si mesmo' },
        { status: 400 }
      )
    }

    // Buscar credenciais do Chatwoot da empresa
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('chatwoot_account_id, chatwoot_api_key')
      .eq('id', currentUser.company_id)
      .single()

    // Remover agente do Chatwoot se tiver ID
    if (member.chatwoot_agent_id && company?.chatwoot_account_id && company?.chatwoot_api_key && CHATWOOT_API_URL) {
      try {
        console.log(`[Remove Member] Removing agent ${member.chatwoot_agent_id} from Chatwoot`)
        const chatwootResponse = await fetch(
          `${CHATWOOT_API_URL}/api/v1/accounts/${company.chatwoot_account_id}/agents/${member.chatwoot_agent_id}`,
          {
            method: 'DELETE',
            headers: {
              'api_access_token': company.chatwoot_api_key,
            }
          }
        )

        if (!chatwootResponse.ok) {
          console.error('[Remove Member] Failed to remove from Chatwoot:', await chatwootResponse.text())
        } else {
          console.log('[Remove Member] Agent removed from Chatwoot successfully')
        }
      } catch (chatwootError) {
        console.error('[Remove Member] Error removing from Chatwoot:', chatwootError)
      }
    }

    // Remover atribuições de inbox
    await supabaseAdmin
      .from('agent_inbox_assignments')
      .delete()
      .eq('user_id', memberId)

    // Remover da empresa (desassociar, não deletar o usuário)
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        company_id: null,
        role_id: null,
        is_active: false,
        chatwoot_agent_id: null,
      })
      .eq('id', memberId)

    if (updateError) {
      console.error('[Remove Member] Error updating user:', updateError)
      return NextResponse.json(
        { success: false, error: 'Erro ao remover membro' },
        { status: 500 }
      )
    }

    console.log(`[Remove Member] Member ${member.email} removed successfully`)

    return NextResponse.json({
      success: true,
      message: 'Membro removido com sucesso'
    })

  } catch (error) {
    console.error('[Remove Member] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/team/members/[id]
 *
 * Atualiza um membro (ativar/desativar, alterar cargo)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Buscar dados do usuário atual
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('company_id, role_id')
      .eq('id', user.id)
      .single()

    if (!currentUser?.company_id) {
      return NextResponse.json(
        { success: false, error: 'User has no company' },
        { status: 400 }
      )
    }

    // Verificar se o membro pertence à mesma empresa
    const { data: member } = await supabaseAdmin
      .from('users')
      .select('id, company_id')
      .eq('id', memberId)
      .eq('company_id', currentUser.company_id)
      .single()

    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Membro não encontrado' },
        { status: 404 }
      )
    }

    // Preparar campos para atualização
    const updateData: Record<string, unknown> = {}

    if (typeof body.is_active === 'boolean') {
      updateData.is_active = body.is_active
    }

    if (body.role_id) {
      updateData.role_id = body.role_id
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhum campo para atualizar' },
        { status: 400 }
      )
    }

    // Atualizar membro
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', memberId)

    if (updateError) {
      console.error('[Update Member] Error:', updateError)
      return NextResponse.json(
        { success: false, error: 'Erro ao atualizar membro' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Membro atualizado com sucesso'
    })

  } catch (error) {
    console.error('[Update Member] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
