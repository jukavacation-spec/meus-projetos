import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const CHATWOOT_API_URL = process.env.CHATWOOT_API_URL || process.env.CHATWOOT_PLATFORM_URL
const CHATWOOT_PLATFORM_TOKEN = process.env.CHATWOOT_PLATFORM_TOKEN

// Cliente admin para operações que precisam bypasser RLS
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Gerar senha aleatória forte (o usuário não vai usar, é só para satisfazer a API do Chatwoot)
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'
  let password = ''
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password + 'Aa1!' // Garantir que tem maiúscula, minúscula, número e especial
}

/**
 * POST /api/team/invite
 *
 * Cria um convite e envia email para o usuario via Supabase
 * Input: { email, roleId, inboxIds? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticacao
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Buscar dados do usuario e empresa
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, name, companies(name)')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json(
        { success: false, error: 'User has no company' },
        { status: 400 }
      )
    }

    const { email, roleId, inboxIds } = await request.json()

    if (!email || !roleId) {
      return NextResponse.json(
        { success: false, error: 'Email and roleId are required' },
        { status: 400 }
      )
    }

    // Validar inboxIds se fornecido
    let validInboxIds: number[] = []
    if (Array.isArray(inboxIds) && inboxIds.length > 0) {
      const numericIds = inboxIds.filter(id => typeof id === 'number') as number[]

      if (numericIds.length > 0) {
        // SECURITY: Validar que os inboxIds pertencem a esta empresa
        const { data: companyInboxes } = await supabase
          .from('company_inbox_settings')
          .select('chatwoot_inbox_id')
          .eq('company_id', userData.company_id)

        const allowedInboxIds = new Set(companyInboxes?.map(i => i.chatwoot_inbox_id) || [])
        validInboxIds = numericIds.filter(id => allowedInboxIds.has(id))

        // Log se algum inbox foi rejeitado (possível tentativa de ataque)
        if (validInboxIds.length !== numericIds.length) {
          console.warn(`[Team Invite] Some inboxIds rejected - not belonging to company ${userData.company_id}`)
        }
      }
    }

    // Verificar se email ja e membro
    const { data: existingMember } = await supabase
      .from('users')
      .select('id')
      .eq('company_id', userData.company_id)
      .ilike('email', email)
      .single()

    if (existingMember) {
      return NextResponse.json(
        { success: false, error: 'Este email ja e membro da equipe' },
        { status: 400 }
      )
    }

    // Verificar se ja existe convite pendente
    const { data: existingInvite } = await supabase
      .from('team_invites')
      .select('id')
      .eq('company_id', userData.company_id)
      .ilike('email', email)
      .eq('status', 'pending')
      .single()

    if (existingInvite) {
      return NextResponse.json(
        { success: false, error: 'Ja existe um convite pendente para este email' },
        { status: 400 }
      )
    }

    // Criar convite no banco
    const { data: invite, error: insertError } = await supabase
      .from('team_invites')
      .insert({
        company_id: userData.company_id,
        email: email.toLowerCase(),
        role_id: roleId,
        invited_by: user.id,
        inbox_ids: validInboxIds,
      })
      .select(`
        *,
        role:roles(*),
        inviter:users!invited_by(name, email)
      `)
      .single()

    if (insertError) throw insertError

    // ============================================
    // CRIAR AGENTE NO CHATWOOT (antes do usuário aceitar)
    // ============================================
    let chatwootAgentId: number | null = null

    // Buscar credenciais do Chatwoot da empresa
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('chatwoot_account_id, chatwoot_api_key')
      .eq('id', userData.company_id)
      .single()

    if (company?.chatwoot_account_id && CHATWOOT_API_URL && CHATWOOT_PLATFORM_TOKEN) {
      try {
        console.log(`[Team Invite] Creating agent in Chatwoot for ${email}`)

        // Mapear role do CRM para role do Chatwoot
        const { data: roleData } = await supabaseAdmin
          .from('roles')
          .select('name')
          .eq('id', roleId)
          .single()

        const chatwootRole = roleData?.name === 'admin' || roleData?.name === 'owner'
          ? 'administrator'
          : 'agent'

        // STEP 1: Criar usuário no Chatwoot via Platform API
        const randomPassword = generateRandomPassword()
        const createUserResponse = await fetch(
          `${CHATWOOT_API_URL}/platform/api/v1/users`,
          {
            method: 'POST',
            headers: {
              'api_access_token': CHATWOOT_PLATFORM_TOKEN,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: email.split('@')[0],
              email: email.toLowerCase(),
              password: randomPassword,
              confirmed: true, // Já confirmado, sem email
              custom_attributes: {}
            })
          }
        )

        let chatwootUserId: number | null = null

        if (createUserResponse.ok) {
          const userData = await createUserResponse.json()
          chatwootUserId = userData.id
          console.log(`[Team Invite] Chatwoot user created with ID: ${chatwootUserId}`)
        } else {
          const errorText = await createUserResponse.text()
          console.log(`[Team Invite] Create user response (${createUserResponse.status}): ${errorText}`)

          // Se o usuário já existe no Chatwoot (422), buscar via Platform API
          if (createUserResponse.status === 422) {
            console.log(`[Team Invite] User already exists in Chatwoot, searching via Platform API...`)

            // Buscar usuário via Platform API
            const searchResponse = await fetch(
              `${CHATWOOT_API_URL}/platform/api/v1/users?email=${encodeURIComponent(email.toLowerCase())}`,
              {
                headers: {
                  'api_access_token': CHATWOOT_PLATFORM_TOKEN
                }
              }
            )

            if (searchResponse.ok) {
              const users = await searchResponse.json()
              if (Array.isArray(users) && users.length > 0) {
                chatwootUserId = users[0].id
                console.log(`[Team Invite] Found existing user via Platform API: ${chatwootUserId}`)
              }
            } else {
              console.log(`[Team Invite] Platform search failed, trying agents list...`)
              // Fallback: buscar na lista de agentes da conta
              const agentsResponse = await fetch(
                `${CHATWOOT_API_URL}/api/v1/accounts/${company.chatwoot_account_id}/agents`,
                {
                  headers: {
                    'api_access_token': company.chatwoot_api_key || CHATWOOT_PLATFORM_TOKEN
                  }
                }
              )

              if (agentsResponse.ok) {
                const agents = await agentsResponse.json()
                const existingAgent = agents.find((a: { email: string; id: number }) =>
                  a.email.toLowerCase() === email.toLowerCase()
                )
                if (existingAgent) {
                  chatwootUserId = existingAgent.id
                  console.log(`[Team Invite] Found existing agent in account: ${chatwootUserId}`)
                }
              }
            }
          }
        }

        // STEP 2: Adicionar usuário como agente na conta
        if (chatwootUserId) {
          const addAgentResponse = await fetch(
            `${CHATWOOT_API_URL}/platform/api/v1/accounts/${company.chatwoot_account_id}/account_users`,
            {
              method: 'POST',
              headers: {
                'api_access_token': CHATWOOT_PLATFORM_TOKEN,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                user_id: chatwootUserId,
                role: chatwootRole
              })
            }
          )

          if (addAgentResponse.ok) {
            console.log(`[Team Invite] User added as agent to account ${company.chatwoot_account_id}`)
          } else {
            const addError = await addAgentResponse.text()
            console.log(`[Team Invite] Add agent response (${addAgentResponse.status}): ${addError}`)
          }

          chatwootAgentId = chatwootUserId

          // STEP 3: Atribuir inboxes ao agente
          if (validInboxIds.length > 0 && company.chatwoot_api_key) {
            for (const inboxId of validInboxIds) {
              try {
                const assignInboxResponse = await fetch(
                  `${CHATWOOT_API_URL}/api/v1/accounts/${company.chatwoot_account_id}/inboxes/${inboxId}/agents`,
                  {
                    method: 'POST',
                    headers: {
                      'api_access_token': company.chatwoot_api_key,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      user_ids: [chatwootAgentId]
                    })
                  }
                )

                if (assignInboxResponse.ok) {
                  console.log(`[Team Invite] Agent assigned to inbox ${inboxId}`)
                } else {
                  console.warn(`[Team Invite] Failed to assign inbox ${inboxId}:`, await assignInboxResponse.text())
                }
              } catch (inboxError) {
                console.error(`[Team Invite] Error assigning inbox ${inboxId}:`, inboxError)
              }
            }
          }

          // STEP 4: Salvar chatwoot_agent_id no convite
          const { error: updateInviteError } = await supabaseAdmin
            .from('team_invites')
            .update({ chatwoot_agent_id: chatwootAgentId })
            .eq('id', invite.id)

          if (updateInviteError) {
            console.error('[Team Invite] Error updating invite with chatwoot_agent_id:', updateInviteError)
          } else {
            console.log(`[Team Invite] Invite updated with chatwoot_agent_id: ${chatwootAgentId}`)
          }
        }
      } catch (chatwootError) {
        console.error('[Team Invite] Chatwoot error:', chatwootError)
        // Continua mesmo se falhar no Chatwoot - pode ser configurado manualmente
      }
    } else {
      console.log('[Team Invite] Chatwoot not configured, skipping agent creation')
    }

    // URL do convite para o admin compartilhar
    const inviteUrl = `${APP_URL}/invite/${invite.token}`

    console.log('[Team Invite] Invite created. URL:', inviteUrl, 'Chatwoot Agent ID:', chatwootAgentId)

    return NextResponse.json({
      success: true,
      invite: { ...invite, chatwoot_agent_id: chatwootAgentId },
      inviteUrl, // Admin deve copiar e enviar este link
    })

  } catch {
    console.error('[Team Invite] Error')
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/team/invite
 *
 * Reenvia um convite existente
 * Input: { inviteId }
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticacao
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { inviteId } = await request.json()

    if (!inviteId) {
      return NextResponse.json(
        { success: false, error: 'inviteId is required' },
        { status: 400 }
      )
    }

    // Buscar dados do usuario
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, name, companies(name)')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json(
        { success: false, error: 'User has no company' },
        { status: 400 }
      )
    }

    // Buscar convite
    const { data: invite, error: fetchError } = await supabase
      .from('team_invites')
      .select(`
        *,
        role:roles(display_name)
      `)
      .eq('id', inviteId)
      .eq('company_id', userData.company_id)
      .single()

    if (fetchError || !invite) {
      return NextResponse.json(
        { success: false, error: 'Convite nao encontrado' },
        { status: 404 }
      )
    }

    // Gerar novo token e atualizar expiracao
    const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error: updateError } = await supabase
      .from('team_invites')
      .update({
        token: newToken,
        expires_at: newExpiresAt,
      })
      .eq('id', inviteId)

    if (updateError) throw updateError

    // Nova URL do convite
    const inviteUrl = `${APP_URL}/invite/${newToken}`

    console.log('[Team Invite Resend] New token generated. URL:', inviteUrl)

    return NextResponse.json({
      success: true,
      inviteUrl,
    })

  } catch {
    console.error('[Team Invite Resend] Error')
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
