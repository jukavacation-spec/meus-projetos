import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rate-limit'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/team/invite/signup
 *
 * Fluxo SIMPLIFICADO (agente já foi criado no Chatwoot quando admin convidou):
 * 1. Validar convite e pegar chatwoot_agent_id
 * 2. Criar usuário no Supabase Auth
 * 3. Atualizar usuário no CRM vinculando ao chatwoot_agent_id
 * 4. Salvar inbox assignments
 * 5. Marcar convite como aceito
 *
 * Input: { token, name, password }
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting para prevenir brute force
    const clientIP = getClientIP(request)
    const rateLimit = checkRateLimit(`auth:${clientIP}`, RATE_LIMITS.auth)

    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: 'Muitas tentativas. Aguarde um momento.' },
        { status: 429 }
      )
    }

    const { token, name, password } = await request.json()

    if (!token || !name || !password) {
      return NextResponse.json(
        { success: false, error: 'Token, nome e senha sao obrigatorios' },
        { status: 400 }
      )
    }

    // SECURITY: Validação de senha forte
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Senha deve ter no minimo 8 caracteres' },
        { status: 400 }
      )
    }

    const hasLetter = /[a-zA-Z]/.test(password)
    const hasNumber = /[0-9]/.test(password)

    if (!hasLetter || !hasNumber) {
      return NextResponse.json(
        { success: false, error: 'Senha deve conter letras e numeros' },
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

    // Pegar o chatwoot_agent_id do convite (já foi criado no momento do convite)
    const chatwootAgentId = invite.chatwoot_agent_id

    console.log(`[Invite Signup] Processing signup for ${invite.email}, chatwoot_agent_id: ${chatwootAgentId}`)

    // ========================================
    // PASSO 2: Criar usuario no Supabase Auth
    // ========================================
    console.log(`[Invite Signup] Creating user in Supabase Auth for ${invite.email}`)

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: name,
        chatwoot_agent_id: chatwootAgentId,
      }
    })

    if (createError) {
      if (createError.message.includes('already been registered')) {
        return NextResponse.json(
          { success: false, error: 'Este email ja possui uma conta. Faca login.' },
          { status: 400 }
        )
      }
      console.error('[Invite Signup] Create user error:', createError)
      return NextResponse.json(
        { success: false, error: createError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { success: false, error: 'Erro ao criar usuario' },
        { status: 500 }
      )
    }

    const userId = authData.user.id
    console.log(`[Invite Signup] Supabase user created with ID: ${userId}`)

    // Aguardar trigger criar registro em users
    await new Promise(resolve => setTimeout(resolve, 500))

    // ========================================
    // PASSO 3: Atualizar usuario no CRM
    // ========================================
    console.log(`[Invite Signup] Updating CRM user`)

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        name: name,
        company_id: invite.company_id,
        role_id: invite.role_id,
        is_active: true,
        chatwoot_agent_id: chatwootAgentId,
      })
      .eq('id', userId)

    if (updateError) {
      console.error('[Invite Signup] Update user error:', updateError)
      return NextResponse.json(
        { success: false, error: 'Erro ao configurar usuario' },
        { status: 500 }
      )
    }

    // ========================================
    // PASSO 4: Salvar atribuicoes de inbox no CRM
    // ========================================
    const inboxIds = invite.inbox_ids || []
    if (inboxIds.length > 0) {
      const inboxAssignments = inboxIds.map((inboxId: number) => ({
        user_id: userId,
        chatwoot_inbox_id: inboxId,
        company_id: invite.company_id,
      }))

      const { error: inboxError } = await supabaseAdmin
        .from('agent_inbox_assignments')
        .insert(inboxAssignments)

      if (inboxError) {
        console.error('[Invite Signup] Error saving inbox assignments:', inboxError)
      }
    }

    // ========================================
    // PASSO 5: Marcar convite como aceito
    // ========================================
    await supabaseAdmin
      .from('team_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invite.id)

    console.log(`[Invite Signup] SUCCESS - User ${invite.email} created with Chatwoot agent ID: ${chatwootAgentId}`)

    // SECURITY: Não retornar tokens de sessão na resposta
    // O cliente deve fazer login usando as credenciais após o signup
    return NextResponse.json({
      success: true,
      message: 'Conta criada e convite aceito!',
      email: invite.email,
      chatwootAgentId,
    })

  } catch (error) {
    console.error('[Invite Signup] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
