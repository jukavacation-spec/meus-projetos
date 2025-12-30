import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateApiKey, hasScope, unauthorizedResponse, forbiddenResponse } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * POST /api/automations/leads/{id}/stage
 *
 * Move um lead para outro estágio do Kanban
 *
 * Body:
 *   - stage: slug do estágio destino (ex: "follow-up", "em-atendimento")
 *   - stage_id: UUID do estágio (alternativa ao slug)
 *
 * Headers:
 *   - Authorization: Bearer deia_XXXXX
 *
 * Response:
 * {
 *   success: true,
 *   lead: { id, stage: { id, name, slug } }
 * }
 */
export async function POST(request: NextRequest, context: RouteParams) {
  try {
    // Validar API Key
    const authResult = await validateApiKey(request)
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error, authResult.status)
    }

    // Verificar scope
    if (!hasScope(authResult.apiKey, 'leads:write')) {
      return forbiddenResponse('leads:write')
    }

    const { id: leadId } = await context.params
    const companyId = authResult.apiKey.companyId
    const body = await request.json()
    const { stage: stageSlug, stage_id: stageId } = body

    if (!stageSlug && !stageId) {
      return NextResponse.json({
        success: false,
        error: 'Either "stage" (slug) or "stage_id" is required'
      }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // Verificar se o lead pertence à empresa
    const { data: lead, error: leadError } = await supabase
      .from('conversations')
      .select('id, company_id')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({
        success: false,
        error: 'Lead not found'
      }, { status: 404 })
    }

    if (lead.company_id !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'Lead not found'
      }, { status: 404 })
    }

    // Resolver stage ID
    let resolvedStageId = stageId
    if (stageSlug && !stageId) {
      const { data: stage } = await supabase
        .from('kanban_stages')
        .select('id')
        .eq('company_id', companyId)
        .eq('slug', stageSlug)
        .single()

      if (!stage) {
        // Listar estágios disponíveis
        const { data: stages } = await supabase
          .from('kanban_stages')
          .select('slug, name')
          .eq('company_id', companyId)
          .order('position')

        return NextResponse.json({
          success: false,
          error: `Stage "${stageSlug}" not found`,
          available_stages: stages || []
        }, { status: 404 })
      }
      resolvedStageId = stage.id
    }

    // Verificar se o estágio pertence à empresa
    const { data: targetStage } = await supabase
      .from('kanban_stages')
      .select('id, name, slug, company_id')
      .eq('id', resolvedStageId)
      .single()

    if (!targetStage || targetStage.company_id !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'Stage not found'
      }, { status: 404 })
    }

    // Atualizar o lead
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        stage_id: resolvedStageId,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)

    if (updateError) {
      console.error('[Automations API] Update error:', updateError)
      return NextResponse.json({
        success: false,
        error: 'Failed to update lead'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      lead: {
        id: leadId,
        stage: {
          id: targetStage.id,
          name: targetStage.name,
          slug: targetStage.slug
        }
      },
      message: `Lead moved to "${targetStage.name}"`
    })

  } catch (error) {
    console.error('[Automations API] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
