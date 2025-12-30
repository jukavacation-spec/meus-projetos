import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getCompanyChatwoot, chatwootRequest } from '@/lib/chatwoot/getCompanyChatwoot'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function normalizePhone(phone: string): string {
  if (!phone) return ''
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

// Format last message preview with media type indicators
function formatLastMessage(lastMessage: {
  content: string
  content_type: string
  attachments?: Array<{ file_type: string }>
} | undefined): string | null {
  if (!lastMessage) return null

  // Check for attachments first
  if (lastMessage.attachments && lastMessage.attachments.length > 0) {
    const fileType = lastMessage.attachments[0].file_type
    switch (fileType) {
      case 'image':
        return '📷 Foto'
      case 'audio':
        return '🎵 Áudio'
      case 'video':
        return '🎬 Vídeo'
      case 'file':
        return '📎 Arquivo'
      case 'location':
        return '📍 Localização'
      default:
        return '📎 Anexo'
    }
  }

  // Handle content types
  if (lastMessage.content_type === 'sticker') {
    return '🏷️ Sticker'
  }

  // Return text content (truncated)
  if (lastMessage.content) {
    return lastMessage.content
  }

  return null
}

type ChatwootConversation = {
  id: number
  inbox_id: number
  status: string
  priority: string | null
  meta: {
    sender: {
      id: number
      name: string
      phone_number: string
      email: string | null
      thumbnail: string
    }
    assignee?: {
      id: number
      name: string
    }
  }
  last_non_activity_message?: {
    content: string
    content_type: string
    attachments?: Array<{ file_type: string }>
  }
  unread_count?: number
  updated_at: number
}

export async function POST() {
  try {
    // Verificar autenticacao e obter credenciais da empresa
    const result = await getCompanyChatwoot()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    const companyId = result.companyId

    // Buscar TODAS as conversas do Chatwoot (com paginacao)
    const allConversations: ChatwootConversation[] = []
    let page = 1
    const pageSize = 25
    let hasMore = true

    while (hasMore) {
      const response = await chatwootRequest<{ data: { payload: ChatwootConversation[], meta: { count: number } } }>(
        result.credentials,
        `/conversations?status=all&page=${page}`
      )
      const pageConversations = response.data?.payload || []
      allConversations.push(...pageConversations)

      // Verificar se ha mais paginas
      if (pageConversations.length < pageSize) {
        hasMore = false
      } else {
        page++
        // Limite de seguranca para evitar loop infinito
        if (page > 50) hasMore = false
      }
    }

    const conversations = allConversations

    let synced = 0
    let created = 0

    // Buscar estágio inicial
    const { data: initialStage } = await supabase
      .from('kanban_stages')
      .select('id')
      .eq('company_id', companyId)
      .eq('is_initial', true)
      .single()

    // Buscar mapeamento de chatwoot_agent_id -> user_id para a empresa
    const { data: companyUsers } = await supabase
      .from('users')
      .select('id, chatwoot_agent_id')
      .eq('company_id', companyId)
      .not('chatwoot_agent_id', 'is', null)

    // Criar mapa de chatwoot_agent_id -> user_id
    const agentToUserMap = new Map<number, string>()
    companyUsers?.forEach(user => {
      if (user.chatwoot_agent_id) {
        agentToUserMap.set(user.chatwoot_agent_id, user.id)
      }
    })

    for (const cwConv of conversations) {
      const sender = cwConv.meta?.sender
      if (!sender?.phone_number) continue

      const phone = normalizePhone(sender.phone_number)
      const phoneNormalized = phone.replace(/\D/g, '')

      // Encontrar ou criar contato
      let { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('company_id', companyId)
        .eq('phone_normalized', phoneNormalized)
        .single()

      if (!contact) {
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            company_id: companyId,
            phone,
            name: sender.name || null,
            email: sender.email || null,
            avatar_url: sender.thumbnail || null,
            chatwoot_contact_id: sender.id,
            source: 'chatwoot',
          })
          .select('id')
          .single()

        if (contactError) {
          console.error('Error creating contact:', contactError)
          continue
        }
        contact = newContact
        created++
      } else {
        // Atualizar dados do contato existente com os dados mais recentes do Chatwoot
        const updates: Record<string, unknown> = {}
        if (sender.thumbnail) {
          updates.avatar_url = sender.thumbnail
        }
        if (sender.name) {
          updates.name = sender.name
        }
        // Sempre atualizar o chatwoot_contact_id para o contato mais recente
        if (sender.id) {
          updates.chatwoot_contact_id = sender.id
        }
        if (Object.keys(updates).length > 0) {
          await supabase
            .from('contacts')
            .update(updates)
            .eq('id', contact.id)
        }
      }

      // Verificar se conversa já existe
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('company_id', companyId)
        .eq('chatwoot_conversation_id', cwConv.id)
        .single()

      // Extract last message preview
      const lastMessagePreview = formatLastMessage(cwConv.last_non_activity_message)
      const unreadCount = cwConv.unread_count || 0

      // Buscar user_id do agente atribuido
      const assigneeAgentId = cwConv.meta?.assignee?.id
      const assignedToUserId = assigneeAgentId ? agentToUserMap.get(assigneeAgentId) : null

      if (!existingConv) {
        // Criar conversa
        const { error: convError } = await supabase
          .from('conversations')
          .insert({
            company_id: companyId,
            contact_id: contact.id,
            chatwoot_conversation_id: cwConv.id,
            chatwoot_inbox_id: cwConv.inbox_id,
            stage_id: initialStage?.id || null,
            status: cwConv.status === 'resolved' ? 'resolved' : 'open',
            priority: cwConv.priority || 'normal',
            last_activity_at: new Date(cwConv.updated_at * 1000).toISOString(),
            last_message: lastMessagePreview,
            unread_count: unreadCount,
            assigned_to: assignedToUserId || null,
          })

        if (convError) {
          console.error('Error creating conversation:', convError)
          continue
        }
        created++
      } else {
        // Atualizar conversa existente (incluindo inbox_id, last_message, unread_count e assigned_to)
        await supabase
          .from('conversations')
          .update({
            chatwoot_inbox_id: cwConv.inbox_id,
            status: cwConv.status === 'resolved' ? 'resolved' : 'open',
            last_activity_at: new Date(cwConv.updated_at * 1000).toISOString(),
            last_message: lastMessagePreview,
            unread_count: unreadCount,
            assigned_to: assignedToUserId || null,
          })
          .eq('id', existingConv.id)
      }

      synced++
    }

    return NextResponse.json({
      success: true,
      synced,
      created,
      total: conversations.length,
      pages: page,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}
