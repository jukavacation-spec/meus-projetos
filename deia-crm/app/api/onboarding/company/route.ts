import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DEFAULT_KANBAN_STAGES } from '@/lib/constants/kanban-stages'

const CHATWOOT_API_URL = process.env.CHATWOOT_API_URL || process.env.CHATWOOT_PLATFORM_URL
const CHATWOOT_PLATFORM_TOKEN = process.env.CHATWOOT_PLATFORM_TOKEN

// Default roles to create for each company
const DEFAULT_ROLES = [
  {
    name: 'owner',
    display_name: 'Proprietario',
    is_system: true,
    permissions: {
      company: { read: true, write: true, delete: true },
      team: { read: true, write: true, delete: true },
      conversations: { read: true, write: true, delete: true },
      contacts: { read: true, write: true, delete: true },
      integrations: { read: true, write: true, delete: true },
      settings: { read: true, write: true, delete: true },
    },
  },
  {
    name: 'admin',
    display_name: 'Administrador',
    is_system: true,
    permissions: {
      company: { read: true, write: true, delete: false },
      team: { read: true, write: true, delete: false },
      conversations: { read: true, write: true, delete: true },
      contacts: { read: true, write: true, delete: true },
      integrations: { read: true, write: true, delete: false },
      settings: { read: true, write: true, delete: false },
    },
  },
  {
    name: 'agent',
    display_name: 'Agente',
    is_system: true,
    permissions: {
      company: { read: true, write: false, delete: false },
      team: { read: true, write: false, delete: false },
      conversations: { read: true, write: true, delete: false },
      contacts: { read: true, write: true, delete: false },
      integrations: { read: false, write: false, delete: false },
      settings: { read: false, write: false, delete: false },
    },
  },
]

/**
 * POST /api/onboarding/company
 *
 * Cria uma nova Company, Roles e Chatwoot Account durante o onboarding
 *
 * Input: { companyName, plan? }
 * Output: { success, company }
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

    // Usar admin client para operacoes que bypassam RLS
    const adminClient = createAdminClient()

    // Verificar se usuario ja tem company
    const { data: existingUser } = await adminClient
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (existingUser?.company_id) {
      return NextResponse.json(
        { success: false, error: 'Usuario ja possui uma empresa' },
        { status: 400 }
      )
    }

    const { companyName, plan = 'basico' } = await request.json()

    if (!companyName || companyName.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Nome da empresa e obrigatorio (minimo 2 caracteres)' },
        { status: 400 }
      )
    }

    // Validar plano
    if (!['basico', 'pro'].includes(plan)) {
      return NextResponse.json(
        { success: false, error: 'Plano invalido. Escolha basico ou pro.' },
        { status: 400 }
      )
    }

    console.log(`[Onboarding] Creating company: ${companyName} (plan: ${plan}) for user ${user.id}`)

    // Gerar slug unico
    const slug = companyName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // 1. Criar Company (usando admin client para bypassar RLS)
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert({
        name: companyName.trim(),
        slug: `${slug}-${Date.now()}`,
        plan: plan,
        additional_instances: 0,
      })
      .select()
      .single()

    if (companyError) {
      console.error('[Onboarding] Error creating company:', companyError)
      return NextResponse.json(
        { success: false, error: 'Erro ao criar empresa' },
        { status: 500 }
      )
    }

    console.log(`[Onboarding] Company created: ${company.id}`)

    // 2. Criar Roles padrao (pode ja existir via trigger do banco)
    const rolesData = DEFAULT_ROLES.map(role => ({
      ...role,
      company_id: company.id,
    }))

    const { data: roles, error: rolesError } = await adminClient
      .from('roles')
      .insert(rolesData)
      .select()

    if (rolesError && rolesError.code !== '23505') {
      // Ignora erro de duplicata (23505) - significa que trigger criou
      console.error('[Onboarding] Error creating roles:', rolesError)
    }

    // Buscar role owner (pode ter sido criada pelo trigger)
    let ownerRole = roles?.find(r => r.name === 'owner')

    if (!ownerRole) {
      const { data: existingOwnerRole } = await adminClient
        .from('roles')
        .select('id')
        .eq('company_id', company.id)
        .eq('name', 'owner')
        .single()

      ownerRole = existingOwnerRole
    }

    // 3. Associar usuario a company com role owner
    const { error: updateError } = await adminClient
      .from('users')
      .update({
        company_id: company.id,
        role_id: ownerRole?.id,
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[Onboarding] Error updating user:', updateError)
      return NextResponse.json(
        { success: false, error: 'Erro ao associar usuario a empresa' },
        { status: 500 }
      )
    }

    console.log(`[Onboarding] User ${user.id} associated with company ${company.id}`)

    // 4. Criar Chatwoot Account
    let chatwootAccountId = null
    let chatwootApiKey = null

    if (CHATWOOT_API_URL && CHATWOOT_PLATFORM_TOKEN) {
      try {
        // Create Account in Chatwoot
        const accountResponse = await fetch(`${CHATWOOT_API_URL}/platform/api/v1/accounts`, {
          method: 'POST',
          headers: {
            'api_access_token': CHATWOOT_PLATFORM_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: companyName
          })
        })

        if (accountResponse.ok) {
          const accountData = await accountResponse.json()
          chatwootAccountId = accountData.id
          console.log(`[Onboarding] Chatwoot account created: ${chatwootAccountId}`)

          // Create Admin User for this account
          const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'Admin'
          const userResponse = await fetch(
            `${CHATWOOT_API_URL}/platform/api/v1/accounts/${chatwootAccountId}/account_users`,
            {
              method: 'POST',
              headers: {
                'api_access_token': CHATWOOT_PLATFORM_TOKEN,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                user_id: null,
                name: userName,
                email: user.email,
                role: 'administrator'
              })
            }
          )

          if (userResponse.ok) {
            const userData = await userResponse.json()
            chatwootApiKey = userData.access_token
            console.log(`[Onboarding] Chatwoot admin user created`)
          } else {
            // Try alternative approach - create user first
            const createUserResponse = await fetch(`${CHATWOOT_API_URL}/platform/api/v1/users`, {
              method: 'POST',
              headers: {
                'api_access_token': CHATWOOT_PLATFORM_TOKEN,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                name: userName,
                email: user.email,
                password: generateRandomPassword(),
                custom_attributes: {}
              })
            })

            if (createUserResponse.ok) {
              const newUser = await createUserResponse.json()

              const addToAccountResponse = await fetch(
                `${CHATWOOT_API_URL}/platform/api/v1/accounts/${chatwootAccountId}/account_users`,
                {
                  method: 'POST',
                  headers: {
                    'api_access_token': CHATWOOT_PLATFORM_TOKEN,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    user_id: newUser.id,
                    role: 'administrator'
                  })
                }
              )

              if (addToAccountResponse.ok) {
                const accountUser = await addToAccountResponse.json()
                chatwootApiKey = accountUser.access_token || newUser.access_token
              }
            }
          }

          // Update company with Chatwoot data
          if (chatwootAccountId) {
            await adminClient
              .from('companies')
              .update({
                chatwoot_account_id: chatwootAccountId,
                chatwoot_api_key: chatwootApiKey,
              })
              .eq('id', company.id)

            // 5. Criar Webhook na Account do Chatwoot para receber eventos
            if (chatwootApiKey) {
              try {
                // Limpar URL de possíveis quebras de linha da variável de ambiente
                const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://chat.faltechia.com').trim().replace(/[\r\n]/g, '')
                const webhookUrl = `${baseUrl}/api/webhooks/chatwoot`

                const webhookResponse = await fetch(
                  `${CHATWOOT_API_URL}/api/v1/accounts/${chatwootAccountId}/webhooks`,
                  {
                    method: 'POST',
                    headers: {
                      'api_access_token': chatwootApiKey,
                      'Accept': 'application/json',
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      url: webhookUrl,
                      subscriptions: [
                        'conversation_created',
                        'conversation_status_changed',
                        'conversation_updated',
                        'message_created',
                        'message_updated',
                        'webwidget_triggered',
                        'contact_created',
                        'contact_updated',
                        'conversation_typing_on',
                        'conversation_typing_off',
                      ],
                    }),
                  }
                )

                if (webhookResponse.ok) {
                  const webhookData = await webhookResponse.json()
                  console.log(`[Onboarding] Webhook criado: ${webhookData.id}`)
                } else {
                  const webhookError = await webhookResponse.text()
                  console.error(`[Onboarding] Erro ao criar webhook: ${webhookError}`)
                }
              } catch (webhookError) {
                console.error('[Onboarding] Webhook exception:', webhookError)
                // Continua sem webhook - pode ser configurado depois
              }

              // 6. Criar Labels no Chatwoot para os estágios do Kanban
              try {
                console.log(`[Onboarding] Criando labels do Kanban no Chatwoot...`)
                let labelsCreated = 0

                for (const stage of DEFAULT_KANBAN_STAGES) {
                  const labelResponse = await fetch(
                    `${CHATWOOT_API_URL}/api/v1/accounts/${chatwootAccountId}/labels`,
                    {
                      method: 'POST',
                      headers: {
                        'api_access_token': chatwootApiKey,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        title: stage.slug,
                        color: stage.color,
                        description: stage.name,
                        show_on_sidebar: true,
                      }),
                    }
                  )

                  if (labelResponse.ok) {
                    labelsCreated++
                  } else {
                    const labelError = await labelResponse.text()
                    console.error(`[Onboarding] Erro ao criar label ${stage.name}: ${labelError}`)
                  }
                }

                console.log(`[Onboarding] ${labelsCreated}/${DEFAULT_KANBAN_STAGES.length} labels criadas`)
              } catch (labelsError) {
                console.error('[Onboarding] Labels exception:', labelsError)
                // Continua sem labels - podem ser sincronizadas depois
              }
            }
          }
        } else {
          const errorText = await accountResponse.text()
          console.error(`[Onboarding] Chatwoot error: ${errorText}`)
        }
      } catch (chatwootError) {
        console.error('[Onboarding] Chatwoot exception:', chatwootError)
        // Continua sem Chatwoot - pode ser configurado depois
      }
    } else {
      console.warn('[Onboarding] Chatwoot not configured')
    }

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        chatwoot_account_id: chatwootAccountId,
      },
    })

  } catch (error) {
    console.error('[Onboarding] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'
  let password = ''
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}
