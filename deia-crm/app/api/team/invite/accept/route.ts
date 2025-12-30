import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Cliente admin para buscar convites (bypassa RLS)
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/team/invite/accept?token=xxx
 *
 * Busca informacoes do convite pelo token (publico, sem auth)
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      )
    }

    // Usar cliente admin para buscar convite (funciona mesmo sem usuario logado)
    const { data: invite, error } = await supabaseAdmin
      .from('team_invites')
      .select(`
        id,
        email,
        expires_at,
        status,
        company:companies(name),
        role:roles(display_name),
        inviter:users!invited_by(name, email)
      `)
      .eq('token', token)
      .single()

    if (error || !invite) {
      console.error('[Accept Invite GET] Error finding invite:', error)
      return NextResponse.json(
        { success: false, error: 'Convite nao encontrado' },
        { status: 404 }
      )
    }

    if (invite.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Este convite ja foi utilizado ou cancelado' },
        { status: 400 }
      )
    }

    // Verificar se o usuario ja existe no sistema
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const userExists = existingUsers?.users.some(u => u.email?.toLowerCase() === invite.email.toLowerCase())

    return NextResponse.json({
      success: true,
      invite,
      userExists: !!userExists,
    })

  } catch (error) {
    console.error('[Accept Invite GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/team/invite/accept
 *
 * Fluxo SIMPLIFICADO (agente já foi criado no Chatwoot quando admin convidou):
 * 1. Validar convite e usuário logado
 * 2. Pegar chatwoot_agent_id do convite
 * 3. Atualizar usuário no CRM
 * 4. Salvar inbox assignments
 * 5. Marcar convite como aceito
 *
 * Input: { token }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticacao
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Voce precisa estar logado para aceitar o convite' },
        { status: 401 }
      )
    }

    const { token } = await request.json()

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      )
    }

    // ========================================
    // PASSO 1: Buscar e validar convite
    // O chatwoot_agent_id já foi criado quando admin enviou o convite
    // ========================================
    const { data: invite, error: fetchError } = await supabaseAdmin
      .from('team_invites')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (fetchError || !invite) {
      console.log('[Accept Invite POST] Invite not found:', { token: token.substring(0, 20), error: fetchError })
      return NextResponse.json(
        { success: false, error: 'Convite nao encontrado ou ja utilizado' },
        { status: 404 }
      )
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Este convite expirou' },
        { status: 400 }
      )
    }

    // Verificar se email confere
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: `Este convite e para ${invite.email}. Voce esta logado como ${user.email}.` },
        { status: 400 }
      )
    }

    // Verificar se usuario ja pertence a outra empresa
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (existingUser?.company_id) {
      return NextResponse.json(
        { success: false, error: 'Voce ja pertence a outra empresa. Entre em contato com o suporte.' },
        { status: 400 }
      )
    }

    // Pegar o chatwoot_agent_id do convite (já foi criado no momento do convite)
    const chatwootAgentId = invite.chatwoot_agent_id

    console.log(`[Accept Invite] Processing accept for ${invite.email}, chatwoot_agent_id: ${chatwootAgentId}`)

    // ========================================
    // PASSO 2: Atualizar usuario no CRM
    // ========================================
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        company_id: invite.company_id,
        role_id: invite.role_id,
        is_active: true,
        chatwoot_agent_id: chatwootAgentId,
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[Accept Invite] Update user error:', updateError)
      return NextResponse.json(
        { success: false, error: 'Erro ao aceitar convite' },
        { status: 500 }
      )
    }

    // ========================================
    // PASSO 3: Salvar atribuições de inbox no CRM
    // ========================================
    const inboxIds = invite.inbox_ids || []
    if (inboxIds.length > 0) {
      const inboxAssignments = inboxIds.map((inboxId: number) => ({
        user_id: user.id,
        chatwoot_inbox_id: inboxId,
        company_id: invite.company_id,
      }))

      const { error: inboxError } = await supabaseAdmin
        .from('agent_inbox_assignments')
        .insert(inboxAssignments)

      if (inboxError) {
        console.error('[Accept Invite] Error saving inbox assignments:', inboxError)
      }
    }

    // ========================================
    // PASSO 4: Marcar convite como aceito
    // ========================================
    await supabaseAdmin
      .from('team_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invite.id)

    console.log(`[Accept Invite] SUCCESS - User ${invite.email} accepted invite with Chatwoot agent ID: ${chatwootAgentId}`)

    return NextResponse.json({
      success: true,
      message: 'Convite aceito com sucesso!',
      chatwootAgentId,
    })

  } catch (error) {
    console.error('[Accept Invite POST] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
