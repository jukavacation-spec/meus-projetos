import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateApiKey, hasScope, unauthorizedResponse, forbiddenResponse } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/automations/leads
 *
 * Lista leads/conversas do Kanban com filtros
 *
 * Query params:
 *   - stage: slug do estágio (ex: "follow-up", "novo", "em-atendimento")
 *   - stage_id: UUID do estágio (alternativa ao slug)
 *   - status: "open", "resolved", "pending"
 *   - limit: número máximo de resultados (default: 50, max: 100)
 *   - offset: paginação
 *   - updated_since: ISO date - apenas leads atualizados após esta data
 *
 * Headers:
 *   - Authorization: Bearer deia_XXXXX
 *   - X-API-Key: deia_XXXXX (alternativa)
 *
 * Response:
 * {
 *   success: true,
 *   leads: [{
 *     id: "uuid",
 *     contact: { id, name, phone, email },
 *     stage: { id, name, slug },
 *     status: "open",
 *     last_message: "...",
 *     last_activity_at: "ISO date",
 *     chatwoot_conversation_id: 123,
 *     created_at: "ISO date"
 *   }],
 *   pagination: { total, limit, offset }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Validar API Key
    const authResult = await validateApiKey(request)
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error, authResult.status)
    }

    // Verificar scope
    if (!hasScope(authResult.apiKey, 'leads:read')) {
      return forbiddenResponse('leads:read')
    }

    const companyId = authResult.apiKey.companyId
    const searchParams = request.nextUrl.searchParams

    // Parâmetros de filtro
    const stageSlug = searchParams.get('stage')
    const stageId = searchParams.get('stage_id')
    const status = searchParams.get('status')
    const updatedSince = searchParams.get('updated_since')
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)
    const offset = Number(searchParams.get('offset')) || 0

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // Se filtrar por stage slug, buscar o ID primeiro
    let resolvedStageId = stageId
    if (stageSlug && !stageId) {
      const { data: stage } = await supabase
        .from('kanban_stages')
        .select('id')
        .eq('company_id', companyId)
        .eq('slug', stageSlug)
        .single()

      if (!stage) {
        return NextResponse.json({
          success: false,
          error: `Stage "${stageSlug}" not found`,
          available_stages: await getAvailableStages(supabase, companyId)
        }, { status: 404 })
      }
      resolvedStageId = stage.id
    }

    // Construir query
    let query = supabase
      .from('conversations')
      .select(`
        id,
        status,
        last_message,
        last_activity_at,
        chatwoot_conversation_id,
        chatwoot_inbox_id,
        unread_count,
        created_at,
        updated_at,
        contact:contacts(id, name, phone, email, avatar_url),
        stage:kanban_stages(id, name, slug, color)
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .order('last_activity_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Aplicar filtros
    if (resolvedStageId) {
      query = query.eq('stage_id', resolvedStageId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (updatedSince) {
      query = query.gte('updated_at', updatedSince)
    }

    const { data: conversations, error, count } = await query

    if (error) {
      console.error('[Automations API] Error:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch leads'
      }, { status: 500 })
    }

    // Transformar para formato mais limpo
    const leads = (conversations || []).map(conv => ({
      id: conv.id,
      contact: conv.contact,
      stage: conv.stage,
      status: conv.status,
      last_message: conv.last_message,
      last_activity_at: conv.last_activity_at,
      unread_count: conv.unread_count,
      chatwoot_conversation_id: conv.chatwoot_conversation_id,
      chatwoot_inbox_id: conv.chatwoot_inbox_id,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
    }))

    return NextResponse.json({
      success: true,
      leads,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      }
    })

  } catch (error) {
    console.error('[Automations API] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Helper para listar estágios disponíveis
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAvailableStages(supabase: any, companyId: string) {
  const { data } = await supabase
    .from('kanban_stages')
    .select('slug, name')
    .eq('company_id', companyId)
    .order('position')

  return data || []
}
