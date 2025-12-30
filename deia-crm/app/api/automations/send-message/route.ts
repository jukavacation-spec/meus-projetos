import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateApiKey, hasScope, unauthorizedResponse, forbiddenResponse } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CHATWOOT_API_URL = process.env.CHATWOOT_API_URL
const UAZAPI_URL = process.env.UAZAPI_URL

/**
 * POST /api/automations/send-message
 *
 * Envia uma mensagem para um lead/contato
 *
 * Body:
 *   - lead_id: UUID da conversa (conversation)
 *   - message: texto da mensagem
 *   - via: "chatwoot" (default) ou "uazapi"
 *
 * Alternativa (enviar por telefone):
 *   - phone: número do telefone (ex: "+5547999999999")
 *   - message: texto da mensagem
 *   - instance_id: UUID da instância WhatsApp (obrigatório se via=uazapi)
 *
 * Headers:
 *   - Authorization: Bearer deia_XXXXX
 *
 * Response:
 * {
 *   success: true,
 *   message_id: "...",
 *   sent_via: "chatwoot" | "uazapi"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Validar API Key
    const authResult = await validateApiKey(request)
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error, authResult.status)
    }

    // Verificar scope
    if (!hasScope(authResult.apiKey, 'messages:send')) {
      return forbiddenResponse('messages:send')
    }

    const companyId = authResult.apiKey.companyId
    const body = await request.json()
    const { lead_id, phone, message, via = 'chatwoot', instance_id } = body

    if (!message) {
      return NextResponse.json({
        success: false,
        error: 'Message is required'
      }, { status: 400 })
    }

    if (!lead_id && !phone) {
      return NextResponse.json({
        success: false,
        error: 'Either lead_id or phone is required'
      }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // Buscar dados necessários
    let chatwootConversationId: number | null = null
    let contactPhone: string | null = phone || null
    let uazapiToken: string | null = null
    let uazapiInstanceName: string | null = null

    if (lead_id) {
      // Buscar conversa pelo ID
      const { data: conversation } = await supabase
        .from('conversations')
        .select(`
          id,
          company_id,
          chatwoot_conversation_id,
          chatwoot_inbox_id,
          contact:contacts(phone)
        `)
        .eq('id', lead_id)
        .single()

      if (!conversation || conversation.company_id !== companyId) {
        return NextResponse.json({
          success: false,
          error: 'Lead not found'
        }, { status: 404 })
      }

      chatwootConversationId = conversation.chatwoot_conversation_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contactPhone = (conversation.contact as any)?.phone

      // Se for via UAZAPI, buscar a instância pelo inbox
      if (via === 'uazapi' && conversation.chatwoot_inbox_id) {
        const { data: instance } = await supabase
          .from('instances')
          .select('uazapi_token, uazapi_instance_name')
          .eq('company_id', companyId)
          .eq('chatwoot_inbox_id', conversation.chatwoot_inbox_id)
          .single()

        if (instance) {
          uazapiToken = instance.uazapi_token
          uazapiInstanceName = instance.uazapi_instance_name
        }
      }
    }

    // Se instance_id foi fornecido, usar essa instância
    if (instance_id) {
      const { data: instance } = await supabase
        .from('instances')
        .select('uazapi_token, uazapi_instance_name, company_id')
        .eq('id', instance_id)
        .single()

      if (!instance || instance.company_id !== companyId) {
        return NextResponse.json({
          success: false,
          error: 'Instance not found'
        }, { status: 404 })
      }

      uazapiToken = instance.uazapi_token
      uazapiInstanceName = instance.uazapi_instance_name
    }

    // Enviar mensagem via Chatwoot
    if (via === 'chatwoot') {
      if (!chatwootConversationId) {
        return NextResponse.json({
          success: false,
          error: 'Lead has no Chatwoot conversation. Use via="uazapi" with phone number instead.'
        }, { status: 400 })
      }

      // Buscar credenciais Chatwoot da empresa
      const { data: company } = await supabase
        .from('companies')
        .select('chatwoot_account_id, chatwoot_api_key')
        .eq('id', companyId)
        .single()

      if (!company?.chatwoot_account_id || !company?.chatwoot_api_key) {
        return NextResponse.json({
          success: false,
          error: 'Company has no Chatwoot configuration'
        }, { status: 400 })
      }

      // Enviar via Chatwoot API
      const chatwootResponse = await fetch(
        `${CHATWOOT_API_URL}/api/v1/accounts/${company.chatwoot_account_id}/conversations/${chatwootConversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'api_access_token': company.chatwoot_api_key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: message,
            message_type: 'outgoing',
            private: false,
          }),
        }
      )

      if (!chatwootResponse.ok) {
        const errorText = await chatwootResponse.text()
        console.error('[Automations API] Chatwoot error:', errorText)
        return NextResponse.json({
          success: false,
          error: 'Failed to send message via Chatwoot'
        }, { status: 500 })
      }

      const chatwootData = await chatwootResponse.json()

      return NextResponse.json({
        success: true,
        message_id: String(chatwootData.id),
        sent_via: 'chatwoot',
        conversation_id: chatwootConversationId
      })
    }

    // Enviar mensagem via UAZAPI
    if (via === 'uazapi') {
      if (!contactPhone) {
        return NextResponse.json({
          success: false,
          error: 'Phone number is required for UAZAPI'
        }, { status: 400 })
      }

      if (!uazapiToken || !uazapiInstanceName) {
        // Tentar buscar primeira instância ativa da empresa
        const { data: instance } = await supabase
          .from('instances')
          .select('uazapi_token, uazapi_instance_name')
          .eq('company_id', companyId)
          .eq('uazapi_status', 'connected')
          .limit(1)
          .single()

        if (!instance) {
          return NextResponse.json({
            success: false,
            error: 'No connected WhatsApp instance found. Provide instance_id or connect an instance.'
          }, { status: 400 })
        }

        uazapiToken = instance.uazapi_token
        uazapiInstanceName = instance.uazapi_instance_name
      }

      // Formatar número
      const formattedPhone = contactPhone.replace(/\D/g, '')
      const jid = formattedPhone.includes('@') ? formattedPhone : `${formattedPhone}@s.whatsapp.net`

      // Enviar via UAZAPI
      const uazapiResponse = await fetch(
        `${UAZAPI_URL}/message/text/${uazapiInstanceName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': uazapiToken!,
          },
          body: JSON.stringify({
            to: jid,
            text: message,
          }),
        }
      )

      if (!uazapiResponse.ok) {
        const errorText = await uazapiResponse.text()
        console.error('[Automations API] UAZAPI error:', errorText)
        return NextResponse.json({
          success: false,
          error: 'Failed to send message via UAZAPI'
        }, { status: 500 })
      }

      const uazapiData = await uazapiResponse.json()

      return NextResponse.json({
        success: true,
        message_id: uazapiData.key?.id || 'sent',
        sent_via: 'uazapi',
        phone: contactPhone
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid "via" parameter. Use "chatwoot" or "uazapi"'
    }, { status: 400 })

  } catch (error) {
    console.error('[Automations API] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
