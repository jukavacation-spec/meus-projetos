import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMaxInstances, getPlanLimits } from '@/lib/plans'

const UAZAPI_URL = process.env.UAZAPI_URL
const UAZAPI_MASTER_TOKEN = process.env.UAZAPI_MASTER_TOKEN
const CHATWOOT_API_URL = process.env.CHATWOOT_API_URL
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * POST /api/integracoes/whatsapp/provision
 *
 * Cria uma nova instancia WhatsApp (UAZAPI) e Inbox no Chatwoot
 *
 * Input: { instanceName }
 * Output: { success, instance }
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

    // Buscar usuario e company
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

    // Buscar company com credenciais Chatwoot, plano e adicionais
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, plan, additional_instances, chatwoot_account_id, chatwoot_api_key')
      .eq('id', userData.company_id)
      .single()

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      )
    }

    // Verificar limite de instancias por plano (base + adicionais compradas)
    const planLimits = getPlanLimits(company.plan)
    const additionalPurchased = company.additional_instances || 0
    const maxAllowed = getMaxInstances(company.plan, additionalPurchased)

    const { count: instanceCount } = await supabase
      .from('instances')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company.id)

    if ((instanceCount || 0) >= maxAllowed) {
      let limitMsg: string

      if (company.plan === 'basico' && additionalPurchased < planLimits.maxAdditionalInstances) {
        // Pode comprar adicional
        limitMsg = `Limite de ${maxAllowed} conexao(oes) atingido. Voce pode adquirir ate ${planLimits.maxAdditionalInstances - additionalPurchased} conexao(oes) adicional(is) por R$${planLimits.additionalInstancePrice} cada, ou fazer upgrade para o plano Pro.`
      } else if (company.plan === 'basico') {
        // Ja tem todos os adicionais do basico
        limitMsg = `Limite maximo do plano Basico atingido (${maxAllowed} conexoes). Faca upgrade para o plano Pro para ter ate 10 conexoes.`
      } else {
        // Plano Pro ou outro
        limitMsg = `Limite de ${maxAllowed} conexao(oes) atingido.`
      }

      return NextResponse.json(
        { success: false, error: limitMsg, code: 'PLAN_LIMIT_REACHED' },
        { status: 403 }
      )
    }

    const { instanceName } = await request.json()

    if (!instanceName || instanceName.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Instance name is required (min 2 characters)' },
        { status: 400 }
      )
    }

    // Gerar nome unico para instancia UAZAPI
    const uazapiInstanceName = `${company.id.slice(0, 8)}-${instanceName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`

    console.log(`[WhatsApp Provision] Creating instance: ${uazapiInstanceName} for company ${company.id}`)

    // Verificar se ja existe instancia com mesmo nome para esta empresa
    const { data: existingInstance } = await supabase
      .from('instances')
      .select('id')
      .eq('company_id', company.id)
      .eq('name', instanceName.trim())
      .single()

    if (existingInstance) {
      return NextResponse.json(
        { success: false, error: 'Ja existe uma instancia com este nome' },
        { status: 400 }
      )
    }

    // 1. Criar instancia no UAZAPI
    let uazapiToken: string | null = null
    let uazapiInstanceId: string | null = null

    if (UAZAPI_URL && UAZAPI_MASTER_TOKEN) {
      try {
        const webhookUrl = `${APP_URL}/api/webhooks/uazapi?instanceId=${uazapiInstanceName}`

        const uazapiResponse = await fetch(`${UAZAPI_URL}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'admintoken': UAZAPI_MASTER_TOKEN,
          },
          body: JSON.stringify({
            name: uazapiInstanceName,
            webhook: webhookUrl,
            webhookEvents: [
              'connection.update',
              'qrcode.updated',
              'messages.upsert',
              'messages.update',
            ],
          }),
        })

        if (uazapiResponse.ok) {
          const uazapiData = await uazapiResponse.json()
          uazapiToken = uazapiData.token || uazapiData.instance?.token
          // Pegar o ID da instância para construir URL do webhook do Chatwoot
          uazapiInstanceId = uazapiData.id || uazapiData.instance?.id || uazapiData.instanceId
          console.log(`[WhatsApp Provision] UAZAPI instance created: ${uazapiInstanceName}, ID: ${uazapiInstanceId}`)

          // Configurar webhook customizado para notificações diretas ao CRM
          if (uazapiToken) {
            try {
              const crmWebhookUrl = `${APP_URL}/api/webhooks/uazapi?instanceId=${uazapiInstanceName}&token=${uazapiToken}`

              const webhookConfigResponse = await fetch(`${UAZAPI_URL}/webhook`, {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  'token': uazapiToken,
                },
                body: JSON.stringify({
                  url: crmWebhookUrl,
                  enabled: true,
                  events: ['messages.upsert', 'connection.update'],
                }),
              })

              if (webhookConfigResponse.ok) {
                console.log(`[WhatsApp Provision] CRM webhook configured for direct notifications`)
              } else {
                console.warn(`[WhatsApp Provision] Failed to configure CRM webhook: ${await webhookConfigResponse.text()}`)
              }
            } catch (webhookError) {
              console.warn(`[WhatsApp Provision] Error configuring CRM webhook:`, webhookError)
            }
          }
        } else {
          const errorText = await uazapiResponse.text()
          console.error(`[WhatsApp Provision] UAZAPI error: ${errorText}`)
          // Continua mesmo com erro - pode ser configurado manualmente
        }
      } catch (uazapiError) {
        console.error(`[WhatsApp Provision] UAZAPI exception:`, uazapiError)
      }
    } else {
      console.warn('[WhatsApp Provision] UAZAPI not configured')
    }

    // 2. Criar Inbox no Chatwoot
    let chatwootInboxId: number | null = null
    let chatwootInboxName: string | null = null

    if (company.chatwoot_account_id && company.chatwoot_api_key && CHATWOOT_API_URL) {
      try {
        const inboxName = `WhatsApp - ${instanceName}`

        // URL do webhook deve apontar para o UAZAPI, não para o CRM
        // O UAZAPI faz a ponte entre WhatsApp e Chatwoot
        let webhookUrl: string
        if (UAZAPI_URL && uazapiToken) {
          // URL correta: UAZAPI recebe webhooks do Chatwoot e repassa para o WhatsApp
          // O token da instância é usado no path, não o ID
          webhookUrl = `${UAZAPI_URL}/chatwoot/webhook/${uazapiToken}`
          console.log(`[WhatsApp Provision] Using UAZAPI webhook URL: ${webhookUrl}`)
        } else {
          // Fallback se UAZAPI não configurado (não vai funcionar para mensagens)
          webhookUrl = `${APP_URL}/api/webhooks/chatwoot`
          console.warn(`[WhatsApp Provision] UAZAPI not available, using fallback webhook URL`)
        }

        // Configurar inbox com header de autenticação para UAZAPI
        const inboxPayload: {
          name: string
          channel: {
            type: string
            webhook_url: string
            additional_attributes?: {
              webhook_headers?: Record<string, string>
            }
          }
        } = {
          name: inboxName,
          channel: {
            type: 'api',
            webhook_url: webhookUrl,
          },
        }

        // Adicionar header token para autenticação no UAZAPI
        if (uazapiToken) {
          inboxPayload.channel.additional_attributes = {
            webhook_headers: {
              token: uazapiToken,
            },
          }
        }

        const inboxResponse = await fetch(
          `${CHATWOOT_API_URL}/api/v1/accounts/${company.chatwoot_account_id}/inboxes`,
          {
            method: 'POST',
            headers: {
              'api_access_token': company.chatwoot_api_key,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(inboxPayload),
          }
        )

        if (inboxResponse.ok) {
          const inboxData = await inboxResponse.json()
          chatwootInboxId = inboxData.id
          chatwootInboxName = inboxData.name
          console.log(`[WhatsApp Provision] Chatwoot inbox created: ${chatwootInboxId} with webhook: ${webhookUrl}`)

          // 2.1 Configurar Chatwoot no UAZAPI (para que UAZAPI envie mensagens para o Chatwoot)
          if (uazapiToken && chatwootInboxId) {
            try {
              console.log(`[WhatsApp Provision] Configuring Chatwoot in UAZAPI...`)
              console.log(`[WhatsApp Provision] - URL: ${UAZAPI_URL}/chatwoot/config`)
              console.log(`[WhatsApp Provision] - Token: ${uazapiToken.substring(0, 10)}...`)
              console.log(`[WhatsApp Provision] - Chatwoot URL: ${CHATWOOT_API_URL}`)
              console.log(`[WhatsApp Provision] - Account ID: ${company.chatwoot_account_id}`)
              console.log(`[WhatsApp Provision] - Inbox ID: ${chatwootInboxId}`)

              const chatwootConfigResponse = await fetch(`${UAZAPI_URL}/chatwoot/config`, {
                method: 'PUT',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  'token': uazapiToken,
                },
                body: JSON.stringify({
                  enabled: true,
                  url: CHATWOOT_API_URL?.trim(),
                  access_token: company.chatwoot_api_key?.trim(),
                  account_id: company.chatwoot_account_id,
                  inbox_id: chatwootInboxId,
                  ignore_groups: true,
                  sign_messages: false,
                  create_new_conversation: false,
                }),
              })

              if (chatwootConfigResponse.ok) {
                const configData = await chatwootConfigResponse.json()
                console.log(`[WhatsApp Provision] Chatwoot configured in UAZAPI successfully:`, JSON.stringify(configData))
              } else {
                const configError = await chatwootConfigResponse.text()
                console.error(`[WhatsApp Provision] Failed to configure Chatwoot in UAZAPI (${chatwootConfigResponse.status}): ${configError}`)
              }
            } catch (configError) {
              console.error(`[WhatsApp Provision] Error configuring Chatwoot in UAZAPI:`, configError)
            }
          } else {
            console.warn(`[WhatsApp Provision] Cannot configure Chatwoot in UAZAPI - missing token (${!!uazapiToken}) or inbox_id (${!!chatwootInboxId})`)
          }
        } else {
          const errorText = await inboxResponse.text()
          console.error(`[WhatsApp Provision] Chatwoot error: ${errorText}`)
        }
      } catch (chatwootError) {
        console.error(`[WhatsApp Provision] Chatwoot exception:`, chatwootError)
      }
    } else {
      console.warn('[WhatsApp Provision] Chatwoot not configured for company')
    }

    // 3. Salvar instancia no banco
    const { data: instance, error: insertError } = await supabase
      .from('instances')
      .insert({
        company_id: company.id,
        name: instanceName.trim(),
        uazapi_instance_name: uazapiInstanceName,
        uazapi_instance_id: uazapiInstanceId,
        uazapi_token: uazapiToken,
        uazapi_status: 'pending',
        chatwoot_inbox_id: chatwootInboxId,
        chatwoot_inbox_name: chatwootInboxName,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[WhatsApp Provision] Database error:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to save instance' },
        { status: 500 }
      )
    }

    console.log(`[WhatsApp Provision] Instance saved: ${instance.id}`)

    return NextResponse.json({
      success: true,
      instance: {
        id: instance.id,
        name: instance.name,
        uazapi_instance_name: instance.uazapi_instance_name,
        uazapi_status: instance.uazapi_status,
        chatwoot_inbox_id: instance.chatwoot_inbox_id,
      },
    })

  } catch (error) {
    console.error('[WhatsApp Provision] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
