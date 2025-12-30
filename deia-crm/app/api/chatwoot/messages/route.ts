import { NextRequest, NextResponse } from 'next/server'
import { getCompanyChatwoot, chatwootRequest } from '@/lib/chatwoot/getCompanyChatwoot'
import { createClient } from '@/lib/supabase/server'

// Detectar e processar mídia em JSON do WhatsApp
// Quando UAZAPI não processa corretamente, envia JSON raw com a estrutura da mídia
function processWhatsAppMedia(content: string): {
  cleanContent: string
  syntheticAttachments: Array<{
    id: number
    file_type: 'image' | 'video' | 'audio' | 'file'
    data_url: string
    thumb_url: string | null
    file_size: number
    extension: string | null
  }>
} {
  if (!content || content.trim() === '') {
    return { cleanContent: content, syntheticAttachments: [] }
  }

  try {
    const parsed = JSON.parse(content)

    // Verificar se tem estrutura de mídia do WhatsApp
    if (parsed.mimetype && (parsed.URL || parsed.directPath || parsed.JPEGThumbnail)) {
      const mimetype = parsed.mimetype || ''
      let fileType: 'image' | 'video' | 'audio' | 'file' = 'file'

      if (mimetype.startsWith('image/')) fileType = 'image'
      else if (mimetype.startsWith('video/')) fileType = 'video'
      else if (mimetype.startsWith('audio/')) fileType = 'audio'

      const extension = mimetype.split('/')[1] || null
      const isGif = mimetype === 'image/gif' || extension === 'gif'

      // Para GIFs, usar URL original para manter animação
      // Para outros tipos, preferir thumbnail base64 (URLs do WhatsApp expiram)
      let dataUrl = ''
      let thumbUrl: string | null = null

      if (isGif && parsed.URL) {
        // GIF: usar URL original para animação
        dataUrl = parsed.URL
        thumbUrl = parsed.JPEGThumbnail
          ? `data:image/jpeg;base64,${parsed.JPEGThumbnail}`
          : parsed.URL
      } else if (parsed.JPEGThumbnail) {
        // Outros: usar thumbnail base64
        dataUrl = `data:image/jpeg;base64,${parsed.JPEGThumbnail}`
        thumbUrl = dataUrl
      } else if (parsed.URL) {
        // Fallback: usar URL original
        dataUrl = parsed.URL
        thumbUrl = parsed.URL
      }

      // Se não temos nenhuma URL válida, retornar sem attachment
      if (!dataUrl) {
        return { cleanContent: content, syntheticAttachments: [] }
      }

      return {
        cleanContent: '', // Remover JSON do content
        syntheticAttachments: [{
          id: Date.now() + Math.random(),
          file_type: fileType,
          data_url: dataUrl,
          thumb_url: thumbUrl,
          file_size: parsed.fileLength || 0,
          extension
        }]
      }
    }
  } catch {
    // Não é JSON válido, retornar como está
  }

  return { cleanContent: content, syntheticAttachments: [] }
}

type ChatwootAttachment = {
  id: number
  file_type: string
  data_url: string
  thumb_url: string | null
  file_size: number
  extension: string | null
}

type ChatwootMessage = {
  id: number
  content: string
  message_type: number // 0 = incoming, 1 = outgoing, 2 = activity
  content_type?: string
  private?: boolean
  created_at: number
  sender: {
    name: string
    type: string
  } | null
  attachments?: ChatwootAttachment[]
}

export async function GET(request: NextRequest) {
  try {
    const result = await getCompanyChatwoot()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
    }

    const response = await chatwootRequest<{ payload: ChatwootMessage[] }>(
      result.credentials,
      `/conversations/${conversationId}/messages`
    )
    const messages = response.payload || []

    // Mapear message_type numérico para string
    const getMessageType = (type: number): 'incoming' | 'outgoing' | 'activity' => {
      switch (type) {
        case 0: return 'incoming'
        case 1: return 'outgoing'
        case 2: return 'activity'
        default: return 'incoming'
      }
    }

    // Transform messages to our format with attachments
    const transformedMessages = messages.map((msg) => {
      // Processar possível mídia em JSON (quando UAZAPI não processa corretamente)
      const { cleanContent, syntheticAttachments } = processWhatsAppMedia(msg.content || '')

      // Combinar attachments do Chatwoot com sintéticos
      const chatwootAttachments = msg.attachments?.map(att => ({
        id: att.id,
        file_type: att.file_type as 'image' | 'video' | 'audio' | 'file',
        data_url: att.data_url,
        thumb_url: att.thumb_url,
        file_size: att.file_size,
        extension: att.extension
      })) || []

      const allAttachments = [...chatwootAttachments, ...syntheticAttachments]

      return {
        id: String(msg.id),
        content: syntheticAttachments.length > 0 ? cleanContent : (msg.content || ''),
        message_type: getMessageType(msg.message_type),
        content_type: msg.content_type,
        private: msg.private || false,
        created_at: new Date(msg.created_at * 1000).toISOString(),
        status: 'delivered',
        sender: msg.sender ? {
          name: msg.sender.name,
          type: msg.sender.type
        } : null,
        attachments: allAttachments
      }
    })

    return NextResponse.json({ messages: transformedMessages })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await getCompanyChatwoot()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    const body = await request.json()
    const { conversationId, content, isPrivate } = body

    if (!conversationId || !content) {
      return NextResponse.json(
        { error: 'conversationId and content are required' },
        { status: 400 }
      )
    }

    // Log para debug - antes de enviar
    console.log('[Chatwoot Messages] Request body:', {
      content,
      message_type: 'outgoing',
      private: isPrivate || false,
      isPrivate_raw: isPrivate
    })

    const message = await chatwootRequest<ChatwootMessage>(
      result.credentials,
      `/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          content,
          message_type: 'outgoing',
          private: isPrivate === true,
        }),
      }
    )

    // Atualizar last_activity_at no CRM após enviar mensagem
    const supabase = await createClient()
    await supabase
      .from('conversations')
      .update({
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('chatwoot_conversation_id', Number(conversationId))
      .eq('company_id', result.companyId)

    // Log para debug
    console.log('[Chatwoot Messages] Sending message:', { conversationId, isPrivate, private: message.private })

    return NextResponse.json({
      message: {
        id: String(message.id),
        content: message.content,
        message_type: 'outgoing',
        created_at: new Date(message.created_at * 1000).toISOString(),
        status: 'sent',
        private: message.private || isPrivate || false
      }
    })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
