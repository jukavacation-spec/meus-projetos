import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyChatwoot, chatwootRequest } from '@/lib/chatwoot/getCompanyChatwoot'

/**
 * POST /api/chatwoot/conversations/[id]/sync-stage
 *
 * Sincroniza o estágio da conversa com as labels do Chatwoot.
 * Remove labels de estágios antigos e adiciona a label do novo estágio.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params
    const body = await request.json()
    const { stageId } = body

    if (!stageId) {
      return NextResponse.json(
        { error: 'Stage ID is required' },
        { status: 400 }
      )
    }

    // Buscar credenciais do Chatwoot
    const chatwootResult = await getCompanyChatwoot()
    if (!chatwootResult.success) {
      return NextResponse.json(
        { error: chatwootResult.error },
        { status: chatwootResult.status }
      )
    }

    const supabase = await createClient()

    // Buscar a conversa para pegar o chatwoot_conversation_id
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('chatwoot_conversation_id')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    const chatwootConvId = conversation.chatwoot_conversation_id
    if (!chatwootConvId) {
      // Conversa não tem ID do Chatwoot - provavelmente foi criada localmente
      return NextResponse.json({
        success: true,
        message: 'No Chatwoot conversation linked'
      })
    }

    // Buscar todos os estágios para saber quais são labels de estágio
    const { data: stages, error: stagesError } = await supabase
      .from('kanban_stages')
      .select('id, slug, name, color')
      .eq('company_id', chatwootResult.companyId)

    if (stagesError) {
      console.error('Error fetching stages:', stagesError)
      return NextResponse.json(
        { error: 'Failed to fetch stages' },
        { status: 500 }
      )
    }

    // Criar mapa de slugs de estágio
    const stageSlugs = new Set(stages?.map(s => s.slug) || [])
    const targetStage = stages?.find(s => s.id === stageId)

    if (!targetStage) {
      return NextResponse.json(
        { error: 'Stage not found' },
        { status: 404 }
      )
    }

    // Buscar labels atuais da conversa no Chatwoot
    let currentLabels: string[] = []
    try {
      const labelsResponse = await chatwootRequest<{ payload: string[] }>(
        chatwootResult.credentials,
        `/conversations/${chatwootConvId}/labels`
      )
      currentLabels = labelsResponse.payload || []
    } catch (err) {
      console.error('Error fetching conversation labels:', err)
      // Continuar mesmo se não conseguir buscar labels
    }

    // Remover labels que correspondem a estágios (exceto o novo)
    // e adicionar a label do novo estágio
    const newLabels = currentLabels
      .filter(label => !stageSlugs.has(label)) // Remove labels de estágios
      .concat([targetStage.slug]) // Adiciona label do novo estágio

    // Remover duplicatas
    const uniqueLabels = [...new Set(newLabels)]

    // Atualizar labels no Chatwoot
    try {
      await chatwootRequest(
        chatwootResult.credentials,
        `/conversations/${chatwootConvId}/labels`,
        {
          method: 'POST',
          body: JSON.stringify({ labels: uniqueLabels })
        }
      )
    } catch (err) {
      console.error('Error updating Chatwoot labels:', err)
      return NextResponse.json(
        { error: 'Failed to sync labels with Chatwoot' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      stage: targetStage.name,
      labels: uniqueLabels
    })
  } catch (error) {
    console.error('Error syncing stage:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
