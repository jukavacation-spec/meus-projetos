import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rate-limit'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CHATWOOT_API_URL = process.env.CHATWOOT_API_URL

type UazapiMessage = {
  key?: {
    remoteJid?: string
    fromMe?: boolean
    id?: string
  }
  message?: {
    conversation?: string
    extendedTextMessage?: { text?: string }
    imageMessage?: { caption?: string; url?: string }
    videoMessage?: { caption?: string }
    audioMessage?: Record<string, unknown>
    documentMessage?: { fileName?: string }
    stickerMessage?: Record<string, unknown>
  }
  messageTimestamp?: number | string
  pushName?: string
}

/**
 * Normaliza telefone para formato E.164
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) {
    return `+${digits}`
  }
  if (digits.length === 11 || digits.length === 10) {
    return `+55${digits}`
  }
  return `+${digits}`
}

/**
 * Extrai numero de telefone do remoteJid do UAZAPI
 */
function extractPhoneFromJid(jid: string): string | null {
  if (!jid) return null
  // Formato: 5511999999999@s.whatsapp.net
  const match = jid.match(/^(\d+)@/)
  return match ? match[1] : null
}

/**
 * Extrai conteudo da mensagem do UAZAPI
 */
function extractMessageContent(message: UazapiMessage['message']): { content: string; type: string } {
  if (!message) return { content: '', type: 'text' }

  if (message.conversation) {
    return { content: message.conversation, type: 'text' }
  }
  if (message.extendedTextMessage?.text) {
    return { content: message.extendedTextMessage.text, type: 'text' }
  }
  if (message.imageMessage) {
    return { content: message.imageMessage.caption || '[Imagem]', type: 'image' }
  }
  if (message.videoMessage) {
    return { content: message.videoMessage.caption || '[Video]', type: 'video' }
  }
  if (message.audioMessage) {
    return { content: '[Audio]', type: 'audio' }
  }
  if (message.documentMessage) {
    return { content: `[Documento: ${message.documentMessage.fileName || 'arquivo'}]`, type: 'file' }
  }
  if (message.stickerMessage) {
    return { content: '[Sticker]', type: 'sticker' }
  }

  return { content: '[Mensagem]', type: 'unknown' }
}

/**
 * Busca ou cria contato no Chatwoot
 */
async function getOrCreateChatwootContact(
  chatwootUrl: string,
  accountId: number,
  apiKey: string,
  inboxId: number,
  phone: string,
  name: string
): Promise<{ id: number; source_id: string } | null> {
  try {
    // Buscar contato existente
    const searchResponse = await fetch(
      `${chatwootUrl}/api/v1/accounts/${accountId}/contacts/search?q=${encodeURIComponent(phone)}`,
      { headers: { 'api_access_token': apiKey } }
    )

    if (searchResponse.ok) {
      const searchData = await searchResponse.json()
      if (searchData.payload?.length > 0) {
        const contact = searchData.payload[0]
        // Verificar se tem contact_inbox para este inbox
        const inboxesResponse = await fetch(
          `${chatwootUrl}/api/v1/accounts/${accountId}/contacts/${contact.id}/contact_inboxes`,
          { headers: { 'api_access_token': apiKey } }
        )
        if (inboxesResponse.ok) {
          const inboxesData = await inboxesResponse.json()
          const existingInbox = inboxesData.payload?.find((ci: { inbox: { id: number }; source_id: string }) => ci.inbox?.id === inboxId)
          if (existingInbox) {
            return { id: contact.id, source_id: existingInbox.source_id }
          }
        }
        // Criar contact_inbox
        const createInboxResponse = await fetch(
          `${chatwootUrl}/api/v1/accounts/${accountId}/contacts/${contact.id}/contact_inboxes`,
          {
            method: 'POST',
            headers: { 'api_access_token': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ inbox_id: inboxId })
          }
        )
        if (createInboxResponse.ok) {
          const newInbox = await createInboxResponse.json()
          return { id: contact.id, source_id: newInbox.payload?.source_id || phone }
        }
        return { id: contact.id, source_id: phone }
      }
    }

    // Criar novo contato
    const createResponse = await fetch(
      `${chatwootUrl}/api/v1/accounts/${accountId}/contacts`,
      {
        method: 'POST',
        headers: { 'api_access_token': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inbox_id: inboxId,
          name: name || phone,
          phone_number: phone,
          identifier: phone
        })
      }
    )

    if (createResponse.ok) {
      const createData = await createResponse.json()
      return {
        id: createData.payload?.contact?.id || createData.payload?.id,
        source_id: createData.payload?.contact_inbox?.source_id || phone
      }
    }

    console.error('[UAZAPI Webhook] Failed to create Chatwoot contact:', await createResponse.text())
    return null
  } catch (error) {
    console.error('[UAZAPI Webhook] Error creating Chatwoot contact:', error)
    return null
  }
}

/**
 * Busca ou cria conversa no Chatwoot
 */
async function getOrCreateChatwootConversation(
  chatwootUrl: string,
  accountId: number,
  apiKey: string,
  inboxId: number,
  sourceId: string,
  contactId: number
): Promise<number | null> {
  try {
    // Buscar conversa existente aberta
    const searchResponse = await fetch(
      `${chatwootUrl}/api/v1/accounts/${accountId}/conversations?inbox_id=${inboxId}&status=open`,
      { headers: { 'api_access_token': apiKey } }
    )

    if (searchResponse.ok) {
      const searchData = await searchResponse.json()
      // Procurar conversa com este contato
      const existing = searchData.data?.payload?.find(
        (c: { meta?: { sender?: { id: number } } }) => c.meta?.sender?.id === contactId
      )
      if (existing) {
        return existing.id
      }
    }

    // Criar nova conversa
    const createResponse = await fetch(
      `${chatwootUrl}/api/v1/accounts/${accountId}/conversations`,
      {
        method: 'POST',
        headers: { 'api_access_token': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inbox_id: inboxId,
          source_id: sourceId,
          contact_id: contactId
        })
      }
    )

    if (createResponse.ok) {
      const createData = await createResponse.json()
      return createData.id
    }

    console.error('[UAZAPI Webhook] Failed to create Chatwoot conversation:', await createResponse.text())
    return null
  } catch (error) {
    console.error('[UAZAPI Webhook] Error creating Chatwoot conversation:', error)
    return null
  }
}

/**
 * Envia mensagem para o Chatwoot
 */
async function sendMessageToChatwoot(
  chatwootUrl: string,
  accountId: number,
  apiKey: string,
  conversationId: number,
  content: string,
  isFromContact: boolean
): Promise<boolean> {
  try {
    const response = await fetch(
      `${chatwootUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: { 'api_access_token': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          message_type: isFromContact ? 'incoming' : 'outgoing',
          private: false
        })
      }
    )

    if (!response.ok) {
      console.error('[UAZAPI Webhook] Failed to send message to Chatwoot:', await response.text())
      return false
    }

    return true
  } catch (error) {
    console.error('[UAZAPI Webhook] Error sending message to Chatwoot:', error)
    return false
  }
}

/**
 * POST /api/webhooks/uazapi?instanceId=xxx
 *
 * Recebe webhooks do UAZAPI para atualizar status das instancias e processar mensagens
 *
 * Eventos tratados:
 * - connection.update: Atualiza status de conexao (conectado/desconectado)
 * - qrcode.updated: Novo QR code disponivel
 * - messages.upsert: Nova mensagem recebida/enviada
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting por IP para prevenir abuso
    const clientIP = getClientIP(request)
    const rateLimit = checkRateLimit(`webhook:${clientIP}`, RATE_LIMITS.webhook)

    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      )
    }

    const { searchParams } = new URL(request.url)
    const instanceName = searchParams.get('instanceId')

    if (!instanceName) {
      console.error('[UAZAPI Webhook] Missing instanceId param')
      return NextResponse.json(
        { success: false, error: 'Missing instanceId' },
        { status: 400 }
      )
    }

    // Obter token de autenticação do header ou query param
    const webhookToken = request.headers.get('x-uazapi-token') ||
                         request.headers.get('authorization')?.replace('Bearer ', '') ||
                         searchParams.get('token')

    // Parsear body do evento
    let event: Record<string, unknown>
    try {
      event = await request.json()
    } catch {
      console.error('[UAZAPI Webhook] Invalid JSON body')
      return NextResponse.json(
        { success: false, error: 'Invalid JSON' },
        { status: 400 }
      )
    }

    // Usar service role para bypassing RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Buscar instancia pelo nome UAZAPI
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('*')
      .eq('uazapi_instance_name', instanceName)
      .single()

    if (instanceError || !instance) {
      console.error(`[UAZAPI Webhook] Instance not found: ${instanceName}`, instanceError)
      return NextResponse.json(
        { success: false, error: 'Instance not found' },
        { status: 404 }
      )
    }

    // SECURITY: Validar token do webhook
    // O token deve corresponder ao uazapi_token armazenado na instância
    // ou ao UAZAPI_WEBHOOK_SECRET global (se configurado)
    const globalWebhookSecret = process.env.UAZAPI_WEBHOOK_SECRET
    const isValidToken = (
      (webhookToken && instance.uazapi_token && webhookToken === instance.uazapi_token) ||
      (webhookToken && globalWebhookSecret && webhookToken === globalWebhookSecret)
    )

    if (!isValidToken) {
      console.error(`[UAZAPI Webhook] Invalid or missing token for instance: ${instanceName}`)
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log(`[UAZAPI Webhook] Authenticated event for ${instanceName}`)

    // Determinar tipo de evento
    // UAZAPI pode enviar eventos em diferentes formatos
    const eventType = event.event || event.type || event.action || ''
    const eventData = (event.data || event.payload || event) as Record<string, unknown>

    console.log(`[UAZAPI Webhook] Event type: ${eventType}, instance: ${instance.id}`)

    // Processar eventos de conexao
    if (
      eventType === 'connection.update' ||
      eventType === 'connection' ||
      eventData.connection !== undefined ||
      eventData.state !== undefined
    ) {
      // Determinar se esta conectado
      // UAZAPI pode enviar em diferentes formatos
      const isConnected =
        eventData.state === 'open' ||
        eventData.connection === 'open' ||
        eventData.connected === true ||
        eventData.status === 'connected' ||
        (eventData.instance as Record<string, unknown>)?.state === 'open'

      const isDisconnected =
        eventData.state === 'close' ||
        eventData.connection === 'close' ||
        eventData.connected === false ||
        eventData.status === 'disconnected' ||
        (eventData.instance as Record<string, unknown>)?.state === 'close'

      let newStatus = instance.uazapi_status

      if (isConnected) {
        newStatus = 'connected'
      } else if (isDisconnected) {
        newStatus = 'disconnected'
      }

      // Atualizar banco se status mudou
      if (newStatus !== instance.uazapi_status) {
        console.log(`[UAZAPI Webhook] Updating status: ${instance.uazapi_status} -> ${newStatus}`)

        const updateData: Record<string, unknown> = {
          uazapi_status: newStatus,
          updated_at: new Date().toISOString(),
        }

        if (newStatus === 'connected') {
          updateData.disconnected_at = null
          if (!instance.connected_at) {
            updateData.connected_at = new Date().toISOString()
          }
        } else if (newStatus === 'disconnected') {
          updateData.disconnected_at = new Date().toISOString()
        }

        const { error: updateError } = await supabase
          .from('instances')
          .update(updateData)
          .eq('id', instance.id)

        if (updateError) {
          console.error(`[UAZAPI Webhook] Failed to update instance:`, updateError)
          return NextResponse.json(
            { success: false, error: 'Failed to update instance' },
            { status: 500 }
          )
        }

        console.log(`[UAZAPI Webhook] Instance ${instance.id} status updated to ${newStatus}`)
      }
    }

    // Processar eventos de QR code
    if (eventType === 'qrcode.updated' || eventType === 'qrcode') {
      // Atualizar status para qr_ready se ainda nao esta conectado
      if (instance.uazapi_status !== 'connected') {
        const { error: updateError } = await supabase
          .from('instances')
          .update({
            uazapi_status: 'qr_ready',
            updated_at: new Date().toISOString(),
          })
          .eq('id', instance.id)

        if (updateError) {
          console.error(`[UAZAPI Webhook] Failed to update QR status:`, updateError)
        } else {
          console.log(`[UAZAPI Webhook] Instance ${instance.id} status updated to qr_ready`)
        }
      }
    }

    // Processar eventos de mensagens
    if (eventType === 'messages.upsert' || eventType === 'message' || eventType === 'messages') {
      console.log(`[UAZAPI Webhook] Processing message event for instance ${instance.id}`)

      // Verificar se temos as credenciais do Chatwoot
      if (!CHATWOOT_API_URL || !instance.chatwoot_inbox_id) {
        console.warn(`[UAZAPI Webhook] Chatwoot not configured for instance ${instance.id}`)
        return NextResponse.json({ success: true, warning: 'Chatwoot not configured' })
      }

      // Buscar credenciais Chatwoot da empresa
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('chatwoot_account_id, chatwoot_api_key')
        .eq('id', instance.company_id)
        .single()

      if (companyError || !company?.chatwoot_account_id || !company?.chatwoot_api_key) {
        console.error(`[UAZAPI Webhook] Company Chatwoot credentials not found for ${instance.company_id}`)
        return NextResponse.json({ success: true, warning: 'Company Chatwoot not configured' })
      }

      // Extrair mensagens do evento
      // UAZAPI pode enviar em diferentes formatos
      const messages: UazapiMessage[] = Array.isArray(eventData.messages)
        ? eventData.messages
        : eventData.message
        ? [eventData.message as UazapiMessage]
        : Array.isArray(eventData)
        ? eventData as UazapiMessage[]
        : [eventData as UazapiMessage]

      for (const msg of messages) {
        // Ignorar mensagens de status (read receipts, etc)
        if (!msg.key?.remoteJid || msg.key.remoteJid.includes('status@broadcast')) {
          continue
        }

        // Ignorar grupos por enquanto
        if (msg.key.remoteJid.includes('@g.us')) {
          console.log(`[UAZAPI Webhook] Ignoring group message`)
          continue
        }

        const phoneNumber = extractPhoneFromJid(msg.key.remoteJid)
        if (!phoneNumber) {
          console.log(`[UAZAPI Webhook] Could not extract phone from ${msg.key.remoteJid}`)
          continue
        }

        const normalizedPhone = normalizePhone(phoneNumber)
        const { content } = extractMessageContent(msg.message)
        const contactName = msg.pushName || phoneNumber
        const isFromMe = msg.key.fromMe === true

        console.log(`[UAZAPI Webhook] Message from ${normalizedPhone} (fromMe: ${isFromMe}): ${content.slice(0, 50)}...`)

        // Buscar ou criar contato no Chatwoot
        const contact = await getOrCreateChatwootContact(
          CHATWOOT_API_URL,
          company.chatwoot_account_id,
          company.chatwoot_api_key,
          instance.chatwoot_inbox_id,
          normalizedPhone,
          contactName
        )

        if (!contact) {
          console.error(`[UAZAPI Webhook] Failed to get/create contact for ${normalizedPhone}`)
          continue
        }

        console.log(`[UAZAPI Webhook] Chatwoot contact: ${contact.id}, source_id: ${contact.source_id}`)

        // Buscar ou criar conversa no Chatwoot
        const conversationId = await getOrCreateChatwootConversation(
          CHATWOOT_API_URL,
          company.chatwoot_account_id,
          company.chatwoot_api_key,
          instance.chatwoot_inbox_id,
          contact.source_id,
          contact.id
        )

        if (!conversationId) {
          console.error(`[UAZAPI Webhook] Failed to get/create conversation for contact ${contact.id}`)
          continue
        }

        console.log(`[UAZAPI Webhook] Chatwoot conversation: ${conversationId}`)

        // Enviar mensagem para o Chatwoot
        const success = await sendMessageToChatwoot(
          CHATWOOT_API_URL,
          company.chatwoot_account_id,
          company.chatwoot_api_key,
          conversationId,
          content,
          !isFromMe // Se nao e fromMe, e do contato
        )

        if (success) {
          console.log(`[UAZAPI Webhook] Message sent to Chatwoot successfully`)

          // Verificar se conversa existe no CRM
          const { data: existingConv } = await supabase
            .from('conversations')
            .select('id, unread_count')
            .eq('chatwoot_conversation_id', conversationId)
            .eq('company_id', instance.company_id)
            .single()

          if (existingConv) {
            // Atualizar conversa existente
            const { error: updateError } = await supabase
              .from('conversations')
              .update({
                last_message: content.length > 100 ? content.substring(0, 100) + '...' : content,
                unread_count: isFromMe ? 0 : (existingConv.unread_count || 0) + 1,
                last_activity_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', existingConv.id)

            if (updateError) {
              console.warn(`[UAZAPI Webhook] Failed to update conversation:`, updateError)
            } else {
              console.log(`[UAZAPI Webhook] Updated CRM conversation ${existingConv.id}`)
            }
          } else {
            // Criar conversa no CRM
            console.log(`[UAZAPI Webhook] Conversation not in CRM, creating...`)

            // Buscar estágio inicial
            const { data: initialStage } = await supabase
              .from('kanban_stages')
              .select('id')
              .eq('company_id', instance.company_id)
              .eq('is_initial', true)
              .single()

            // Buscar ou criar contato no CRM
            const phoneNormalized = normalizedPhone.replace(/\D/g, '')
            let crmContactId: string | null = null

            const { data: existingContact } = await supabase
              .from('contacts')
              .select('id')
              .eq('phone_normalized', phoneNormalized)
              .eq('company_id', instance.company_id)
              .single()

            if (existingContact) {
              crmContactId = existingContact.id
            } else {
              // Criar novo contato
              const { data: newContact } = await supabase
                .from('contacts')
                .insert({
                  company_id: instance.company_id,
                  phone: normalizedPhone,
                  phone_normalized: phoneNormalized,
                  name: contactName,
                  chatwoot_contact_id: contact.id,
                  source: 'whatsapp'
                })
                .select('id')
                .single()

              crmContactId = newContact?.id || null
              console.log(`[UAZAPI Webhook] Created CRM contact ${crmContactId}`)
            }

            // Criar conversa no CRM
            if (crmContactId) {
              const { data: newConv, error: convError } = await supabase
                .from('conversations')
                .insert({
                  company_id: instance.company_id,
                  contact_id: crmContactId,
                  chatwoot_conversation_id: conversationId,
                  chatwoot_inbox_id: instance.chatwoot_inbox_id,
                  stage_id: initialStage?.id || null,
                  status: 'open',
                  last_message: content.length > 100 ? content.substring(0, 100) + '...' : content,
                  unread_count: isFromMe ? 0 : 1,
                  last_activity_at: new Date().toISOString()
                })
                .select('id')
                .single()

              if (convError) {
                console.error(`[UAZAPI Webhook] Failed to create CRM conversation:`, convError)
              } else {
                console.log(`[UAZAPI Webhook] Created CRM conversation ${newConv?.id}`)
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[UAZAPI Webhook] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Suportar GET para verificacao de webhook
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'UAZAPI webhook endpoint is active',
    timestamp: new Date().toISOString(),
  })
}
