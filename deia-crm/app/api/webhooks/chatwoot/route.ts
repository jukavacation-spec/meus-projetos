import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Usar service role para bypass de RLS (sem tipagem estrita para flexibilidade)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+${digits}`
  }
  if (digits.length === 11) {
    return `+55${digits}`
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+${digits}`
  }
  return digits.startsWith('+') ? phone : `+${digits}`
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const { event, account, conversation, message, contact } = payload

    // Verificar webhook secret se configurado
    const webhookSecret = req.headers.get('x-chatwoot-signature')
    if (process.env.CHATWOOT_WEBHOOK_SECRET && webhookSecret !== process.env.CHATWOOT_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()

    // Identificar empresa pelo account_id do Chatwoot
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('chatwoot_account_id', account?.id)
      .single()

    if (companyError || !companyData) {
      console.error('Company not found for Chatwoot account:', account?.id)
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const companyId = companyData.id

    switch (event) {
      case 'conversation_created':
        await handleConversationCreated(supabase, companyId, conversation, contact)
        break

      case 'conversation_status_changed':
        await handleConversationStatusChanged(supabase, companyId, conversation)
        break

      case 'conversation_updated':
        await handleConversationUpdated(supabase, companyId, conversation)
        break

      case 'message_created':
        await handleMessageCreated(supabase, companyId, conversation, message)
        break

      case 'webwidget_triggered':
        // Ignorar eventos de widget
        break

      default:
        console.log('Unhandled Chatwoot event:', event)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleConversationCreated(
  supabase: any,
  companyId: string,
  cwConversation: any,
  cwContact: any
) {
  // 1. Encontrar ou criar contato
  const phone = normalizePhone(cwContact?.phone_number || '')

  if (!phone) {
    console.error('No phone number in contact')
    return
  }

  const phoneNormalized = phone.replace(/\D/g, '')

  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('company_id', companyId)
    .eq('phone_normalized', phoneNormalized)
    .single()

  let contactId: string

  if (!existingContact) {
    const { data: newContact, error } = await supabase
      .from('contacts')
      .insert({
        company_id: companyId,
        phone,
        name: cwContact?.name || null,
        email: cwContact?.email || null,
        avatar_url: cwContact?.avatar_url || null,
        chatwoot_contact_id: cwContact?.id,
        source: 'whatsapp',
      })
      .select('id')
      .single()

    if (error || !newContact) {
      console.error('Error creating contact:', error)
      return
    }
    contactId = newContact.id
  } else {
    contactId = existingContact.id
  }

  // 2. Pegar estagio inicial
  const { data: initialStage } = await supabase
    .from('kanban_stages')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_initial', true)
    .single()

  // 3. Criar conversa no CRM
  const { data: newConversation, error: convError } = await supabase
    .from('conversations')
    .insert({
      company_id: companyId,
      contact_id: contactId,
      chatwoot_conversation_id: cwConversation?.id,
      chatwoot_inbox_id: cwConversation?.inbox_id,
      stage_id: initialStage?.id || null,
      status: 'open',
    })
    .select('id')
    .single()

  if (convError) {
    console.error('Error creating conversation:', convError)
    return
  }

  // 4. Registrar na timeline
  await supabase.from('timeline_events').insert({
    company_id: companyId,
    contact_id: contactId,
    conversation_id: newConversation.id,
    event_type: 'conversation_started',
    data: {
      source: 'whatsapp',
      chatwoot_conversation_id: cwConversation?.id,
      inbox_id: cwConversation?.inbox_id,
    },
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleConversationStatusChanged(
  supabase: any,
  companyId: string,
  cwConversation: any
) {
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, contact_id, status')
    .eq('company_id', companyId)
    .eq('chatwoot_conversation_id', cwConversation?.id)
    .single()

  if (!conversation) return

  const newStatus = cwConversation?.status === 'resolved' ? 'resolved' : 'open'
  const oldStatus = conversation.status

  if (oldStatus === newStatus) return

  await supabase
    .from('conversations')
    .update({
      status: newStatus,
      resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversation.id)

  // Timeline event
  await supabase.from('timeline_events').insert({
    company_id: companyId,
    contact_id: conversation.contact_id,
    conversation_id: conversation.id,
    event_type: 'status_changed',
    data: { from: oldStatus, to: newStatus },
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleConversationUpdated(
  supabase: any,
  companyId: string,
  cwConversation: any
) {
  await supabase
    .from('conversations')
    .update({
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId)
    .eq('chatwoot_conversation_id', cwConversation?.id)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleMessageCreated(
  supabase: any,
  companyId: string,
  cwConversation: any,
  message: any
) {
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, contact_id, first_response_at')
    .eq('company_id', companyId)
    .eq('chatwoot_conversation_id', cwConversation?.id)
    .single()

  if (!conversation) return

  // Atualizar last_activity_at
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: any = {
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Se e a primeira resposta do agente, registrar
  if (!conversation.first_response_at && message?.message_type === 1) {
    updates.first_response_at = new Date().toISOString()
  }

  await supabase
    .from('conversations')
    .update(updates)
    .eq('id', conversation.id)

  // Timeline event (resumido, sem conteudo da mensagem)
  await supabase.from('timeline_events').insert({
    company_id: companyId,
    contact_id: conversation.contact_id,
    conversation_id: conversation.id,
    event_type: message?.message_type === 0 ? 'message_received' : 'message_sent',
    data: {
      message_type: message?.message_type === 0 ? 'incoming' : 'outgoing',
      content_type: message?.content_type,
    },
  })
}
