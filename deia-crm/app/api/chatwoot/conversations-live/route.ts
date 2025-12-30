import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabaseAdmin() {
  return createAdminClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })
}

type LiveConversation = {
  chatwoot_conversation_id: number
  last_message: string | null
  unread_count: number
  last_activity_at: string
}

/**
 * GET /api/chatwoot/conversations-live
 * Retorna dados em tempo real do Chatwoot (last_message, unread_count)
 * sem modificar o banco de dados
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const supabaseAdmin = getSupabaseAdmin()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('chatwoot_account_id, chatwoot_api_key, chatwoot_url')
      .eq('id', userData.company_id)
      .single()

    if (!company?.chatwoot_account_id || !company?.chatwoot_api_key) {
      return NextResponse.json({ error: 'Chatwoot not configured' }, { status: 400 })
    }

    const chatwootUrl = company.chatwoot_url || 'https://desk.faltechia.com'

    // Buscar conversas abertas no Chatwoot
    const response = await fetch(
      `${chatwootUrl}/api/v1/accounts/${company.chatwoot_account_id}/conversations?status=open`,
      {
        headers: {
          'Accept': 'application/json',
          'api_access_token': company.chatwoot_api_key,
        },
        cache: 'no-store'
      }
    )

    if (!response.ok) {
      return NextResponse.json({ error: 'Chatwoot API error' }, { status: 500 })
    }

    const data = await response.json()
    const conversations = data.data?.payload || []

    // Transformar para formato simplificado
    const liveData: LiveConversation[] = conversations.map((conv: {
      id: number
      unread_count: number
      last_activity_at: number
      last_non_activity_message?: {
        content?: string
        attachments?: Array<{ file_type?: string }>
      }
    }) => {
      const lastMsg = conv.last_non_activity_message
      let lastMsgPreview = lastMsg?.content || null

      // Se não tem texto mas tem anexo
      if (!lastMsgPreview && lastMsg?.attachments?.length) {
        const attachment = lastMsg.attachments[0]
        const mediaLabels: Record<string, string> = {
          image: '📷 Imagem',
          audio: '🎵 Áudio',
          video: '🎬 Vídeo',
          file: '📎 Arquivo',
        }
        lastMsgPreview = mediaLabels[attachment.file_type || 'file'] || '📎 Anexo'
      }

      // Truncar se muito longo
      if (lastMsgPreview && lastMsgPreview.length > 100) {
        lastMsgPreview = lastMsgPreview.substring(0, 100) + '...'
      }

      return {
        chatwoot_conversation_id: conv.id,
        last_message: lastMsgPreview,
        unread_count: conv.unread_count || 0,
        last_activity_at: new Date(conv.last_activity_at * 1000).toISOString()
      }
    })

    return NextResponse.json(liveData)
  } catch (error) {
    console.error('[conversations-live] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
