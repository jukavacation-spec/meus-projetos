import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Tipos para webhooks do Chatwoot
type ChatwootContact = {
  id?: number
  phone_number?: string
  name?: string
  email?: string
  avatar_url?: string
}

type ChatwootConversation = {
  id?: number
  inbox_id?: number
  status?: string
  priority?: string | null  // 'urgent' | 'high' | 'medium' | 'low' | null
  labels?: string[]
  assignee?: {
    id: number
    name?: string
  } | null
  meta?: {
    assignee?: {
      id: number
      name?: string
    } | null
  }
  // changed_attributes é enviado quando atributos mudam (ex: assignee_id)
  changed_attributes?: Array<Record<string, { current_value?: unknown; previous_value?: unknown }>>
}

type ChatwootMessage = {
  id?: number
  content?: string
  message_type?: number // 0 = incoming, 1 = outgoing
  content_type?: string // text, input_select, cards, form, article, input_email, input_csat, integrations, sticker
  private?: boolean
  sender?: {
    type?: string
  }
  attachments?: Array<{
    file_type?: string // image, audio, video, file, location, contact, fallback
    data_url?: string
  }>
}

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

// Salvar evento para auditoria e retry
async function saveWebhookEvent(
  supabase: SupabaseClient,
  companyId: string | null,
  eventType: string,
  payload: unknown
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('webhook_events')
      .insert({
        company_id: companyId,
        source: 'chatwoot',
        event_type: eventType,
        payload,
        status: 'processing',
        attempts: 1
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Webhook Event] Error saving:', error)
      return null
    }
    return data.id
  } catch {
    return null
  }
}

// Atualizar status do evento
async function updateWebhookEventStatus(
  supabase: SupabaseClient,
  eventId: string | null,
  status: 'completed' | 'failed',
  error?: string
) {
  if (!eventId) return

  try {
    await supabase
      .from('webhook_events')
      .update({
        status,
        last_error: error || null,
        processed_at: status === 'completed' ? new Date().toISOString() : null
      })
      .eq('id', eventId)
  } catch {
    // Silently fail - don't break the webhook
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  let webhookEventId: string | null = null

  try {
    const payload = await req.json()
    const { event, account, conversation, message, contact } = payload

    // Log para rastreamento
    console.log('[Chatwoot Webhook] Received from account:', account?.id)

    // Log para debug
    console.log('[Chatwoot Webhook] Event:', event, '| Account:', account?.id, '| Conv:', conversation?.id)

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

    // Salvar evento para auditoria/retry (não bloqueia se falhar)
    webhookEventId = await saveWebhookEvent(supabase, companyId, event, payload)

    switch (event) {
      case 'conversation_created':
        await handleConversationCreated(supabase, companyId, conversation, contact)
        break

      case 'conversation_status_changed':
        await handleConversationStatusChanged(supabase, companyId, conversation)
        break

      case 'conversation_updated':
        console.log('[Webhook] conversation_updated - FULL PAYLOAD:', JSON.stringify({
          assignee: conversation?.assignee,
          meta: conversation?.meta,
          changed_attributes: conversation?.changed_attributes,
        }))
        await handleConversationUpdated(supabase, companyId, conversation)
        break

      case 'message_created':
        await handleMessageCreated(supabase, companyId, conversation, message)
        break

      case 'webwidget_triggered':
        // Ignorar eventos de widget
        break

      case 'contact_created':
        // Contatos são criados automaticamente via conversation_created
        break

      case 'contact_updated':
        await handleContactUpdated(supabase, companyId, contact)
        break

      default:
        console.log('Unhandled Chatwoot event:', event)
    }

    // Marcar evento como processado com sucesso
    await updateWebhookEventStatus(supabase, webhookEventId, 'completed')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)

    // Marcar evento como falho para retry posterior
    const supabase = getSupabaseAdmin()
    await updateWebhookEventStatus(
      supabase,
      webhookEventId,
      'failed',
      error instanceof Error ? error.message : 'Unknown error'
    )

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function handleConversationCreated(
  supabase: SupabaseClient,
  companyId: string,
  cwConversation: ChatwootConversation,
  cwContact: ChatwootContact
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
    // Atualizar dados do contato existente com os dados mais recentes do Chatwoot
    const updates: Record<string, unknown> = {}
    if (cwContact?.avatar_url) {
      updates.avatar_url = cwContact.avatar_url
    }
    if (cwContact?.name) {
      updates.name = cwContact.name
    }
    // Sempre atualizar o chatwoot_contact_id para o contato mais recente
    if (cwContact?.id) {
      updates.chatwoot_contact_id = cwContact.id
    }
    if (Object.keys(updates).length > 0) {
      await supabase
        .from('contacts')
        .update(updates)
        .eq('id', contactId)
    }
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

async function handleConversationStatusChanged(
  supabase: SupabaseClient,
  companyId: string,
  cwConversation: ChatwootConversation
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

async function handleConversationUpdated(
  supabase: SupabaseClient,
  companyId: string,
  cwConversation: ChatwootConversation
) {
  // Buscar a conversa atual
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, stage_id, contact_id, assigned_to, priority')
    .eq('company_id', companyId)
    .eq('chatwoot_conversation_id', cwConversation?.id)
    .single()

  if (!conversation) return

  const updates: Record<string, unknown> = {
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Sincronizar priority se mudou
  if ('priority' in (cwConversation || {})) {
    const newPriority = cwConversation.priority || 'none'
    if (newPriority !== conversation.priority) {
      updates.priority = newPriority

      // Registrar na timeline a mudança de prioridade
      await supabase.from('timeline_events').insert({
        company_id: companyId,
        contact_id: conversation.contact_id,
        conversation_id: conversation.id,
        event_type: 'priority_changed',
        data: {
          from_priority: conversation.priority,
          to_priority: newPriority,
          source: 'chatwoot',
        },
      })
    }
  }

  // SEMPRE sincronizar o assignee em conversation_updated
  // O assignee pode vir de: meta.assignee, assignee no root, ou ser null/undefined
  const assigneeFromMeta = cwConversation?.meta?.assignee
  const assigneeFromRoot = cwConversation?.assignee

  // Pegar o ID do assignee (pode ser null se desatribuído)
  const assigneeAgentId = assigneeFromMeta?.id ?? assigneeFromRoot?.id ?? null

  console.log('[Webhook] SYNC assignee - fromMeta:', JSON.stringify(assigneeFromMeta), 'fromRoot:', JSON.stringify(assigneeFromRoot), 'agentId:', assigneeAgentId)

  let newAssignedTo: string | null = null

  if (assigneeAgentId) {
    // Buscar user_id pelo chatwoot_agent_id
    const { data: assignedUser } = await supabase
      .from('users')
      .select('id')
      .eq('company_id', companyId)
      .eq('chatwoot_agent_id', assigneeAgentId)
      .single()

    newAssignedTo = assignedUser?.id || null
    console.log('[Webhook] Found user for agent', assigneeAgentId, ':', newAssignedTo)
  } else {
    console.log('[Webhook] No assignee in payload - will unassign')
  }

  // Apenas atualizar se mudou
  if (newAssignedTo !== conversation.assigned_to) {
    console.log('[Webhook] Updating assigned_to from', conversation.assigned_to, 'to', newAssignedTo)
    updates.assigned_to = newAssignedTo

    // Registrar na timeline a mudança de atribuição
    await supabase.from('timeline_events').insert({
      company_id: companyId,
      contact_id: conversation.contact_id,
      conversation_id: conversation.id,
      event_type: 'assignment_changed',
      data: {
        from_user_id: conversation.assigned_to,
        to_user_id: newAssignedTo,
        chatwoot_agent_id: assigneeAgentId,
        source: 'chatwoot',
      },
    })
  } else {
    console.log('[Webhook] assigned_to unchanged:', conversation.assigned_to)
  }

  // Verificar se as labels mudaram e atualizar o estágio
  if (cwConversation?.labels && cwConversation.labels.length > 0) {
    // Buscar todos os estágios da empresa para identificar qual label corresponde
    const { data: stages } = await supabase
      .from('kanban_stages')
      .select('id, slug')
      .eq('company_id', companyId)

    if (stages && stages.length > 0) {
      // Criar mapa de slug -> stage_id
      const slugToStageId = new Map(stages.map(s => [s.slug, s.id]))

      // Encontrar a primeira label que corresponde a um estágio
      for (const label of cwConversation.labels) {
        const stageId = slugToStageId.get(label)
        if (stageId && stageId !== conversation.stage_id) {
          updates.stage_id = stageId

          // Registrar na timeline a mudança de estágio
          const oldStage = stages.find(s => s.id === conversation.stage_id)
          const newStage = stages.find(s => s.id === stageId)

          await supabase.from('timeline_events').insert({
            company_id: companyId,
            contact_id: conversation.contact_id,
            conversation_id: conversation.id,
            event_type: 'stage_changed',
            data: {
              from_stage_id: conversation.stage_id,
              to_stage_id: stageId,
              from_stage_slug: oldStage?.slug,
              to_stage_slug: newStage?.slug,
              source: 'chatwoot_label',
            },
          })

          break // Usar apenas o primeiro estágio encontrado
        }
      }
    }
  }

  await supabase
    .from('conversations')
    .update(updates)
    .eq('id', conversation.id)
}

async function handleMessageCreated(
  supabase: SupabaseClient,
  companyId: string,
  cwConversation: ChatwootConversation,
  message: ChatwootMessage
) {
  console.log('[Webhook] message_created - conv:', cwConversation?.id, '| content:', message?.content?.substring(0, 50) || '[media]')

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, contact_id, first_response_at, unread_count')
    .eq('company_id', companyId)
    .eq('chatwoot_conversation_id', cwConversation?.id)
    .single()

  if (!conversation) {
    console.log('[Webhook] message_created - Conversa não encontrada no CRM para chatwoot_conversation_id:', cwConversation?.id)
    return
  }

  // Ignorar mensagens privadas (notas internas)
  if (message?.private) return

  // Atualizar conversa com última mensagem
  const updates: {
    last_activity_at: string
    updated_at: string
    last_message?: string
    unread_count?: number
    first_response_at?: string
  } = {
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Atualizar última mensagem (truncar se muito longa)
  if (message?.content) {
    updates.last_message = message.content.length > 100
      ? message.content.substring(0, 100) + '...'
      : message.content
  } else if (message?.attachments && message.attachments.length > 0) {
    // Se não tem texto mas tem anexo, mostrar tipo de mídia
    const attachment = message.attachments[0]
    const mediaLabels: Record<string, string> = {
      image: '📷 Imagem',
      audio: '🎵 Áudio',
      video: '🎬 Vídeo',
      file: '📎 Arquivo',
      location: '📍 Localização',
      contact: '👤 Contato',
      sticker: '🏷️ Sticker',
    }
    updates.last_message = mediaLabels[attachment.file_type || 'file'] || '📎 Anexo'
  }

  // Incrementar unread_count se for mensagem do cliente (incoming)
  if (message?.message_type === 0) {
    updates.unread_count = (conversation.unread_count || 0) + 1
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

async function handleContactUpdated(
  supabase: SupabaseClient,
  companyId: string,
  cwContact: ChatwootContact
) {
  if (!cwContact?.id) return

  // Buscar contato pelo chatwoot_contact_id
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, name, email, avatar_url')
    .eq('company_id', companyId)
    .eq('chatwoot_contact_id', cwContact.id)
    .single()

  if (!existingContact) {
    console.log('[Webhook] contact_updated: Contato não encontrado no CRM', cwContact.id)
    return
  }

  // Montar atualizações apenas para campos que mudaram
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (cwContact.name && cwContact.name !== existingContact.name) {
    updates.name = cwContact.name
  }

  if (cwContact.email && cwContact.email !== existingContact.email) {
    updates.email = cwContact.email
  }

  if (cwContact.avatar_url && cwContact.avatar_url !== existingContact.avatar_url) {
    updates.avatar_url = cwContact.avatar_url
  }

  // Só atualizar se houver mudanças reais
  if (Object.keys(updates).length > 1) {
    await supabase
      .from('contacts')
      .update(updates)
      .eq('id', existingContact.id)

    console.log('[Webhook] contact_updated: Contato atualizado', existingContact.id)
  }
}
