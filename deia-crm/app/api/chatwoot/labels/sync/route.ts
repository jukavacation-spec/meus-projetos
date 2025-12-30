import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyChatwoot, chatwootRequest } from '@/lib/chatwoot/getCompanyChatwoot'

type Label = {
  id: number
  title: string
  color: string
}

/**
 * POST /api/chatwoot/labels/sync
 *
 * Sincroniza todos os estágios do Kanban com as labels do Chatwoot.
 * Cria labels que não existem e atualiza as que existem.
 */
export async function POST() {
  try {
    const chatwootResult = await getCompanyChatwoot()
    if (!chatwootResult.success) {
      return NextResponse.json(
        { error: chatwootResult.error },
        { status: chatwootResult.status }
      )
    }

    const supabase = await createClient()

    // Buscar todos os estágios da empresa
    const { data: stages, error: stagesError } = await supabase
      .from('kanban_stages')
      .select('id, name, slug, color')
      .eq('company_id', chatwootResult.companyId)
      .order('position', { ascending: true })

    if (stagesError) {
      console.error('Error fetching stages:', stagesError)
      return NextResponse.json(
        { error: 'Failed to fetch stages' },
        { status: 500 }
      )
    }

    if (!stages || stages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No stages to sync',
        created: 0,
        updated: 0,
      })
    }

    // Buscar labels existentes no Chatwoot
    let existingLabels: Label[] = []
    try {
      const labelsResponse = await chatwootRequest<{ payload: Label[] }>(
        chatwootResult.credentials,
        '/labels'
      )
      existingLabels = labelsResponse.payload || []
    } catch (err) {
      console.error('Error fetching Chatwoot labels:', err)
    }

    // Criar mapa de labels existentes por título
    const labelsByTitle = new Map(existingLabels.map(l => [l.title, l]))

    let created = 0
    let updated = 0
    const errors: string[] = []

    // Sincronizar cada estágio
    for (const stage of stages) {
      const existingLabel = labelsByTitle.get(stage.slug)

      try {
        if (existingLabel) {
          // Atualizar label existente se a cor for diferente
          if (existingLabel.color !== stage.color) {
            await chatwootRequest(
              chatwootResult.credentials,
              `/labels/${existingLabel.id}`,
              {
                method: 'PATCH',
                body: JSON.stringify({
                  title: stage.slug,
                  color: stage.color,
                  description: stage.name,
                }),
              }
            )
            updated++
          }
        } else {
          // Criar nova label
          await chatwootRequest(
            chatwootResult.credentials,
            '/labels',
            {
              method: 'POST',
              body: JSON.stringify({
                title: stage.slug,
                color: stage.color,
                description: stage.name,
                show_on_sidebar: true,
              }),
            }
          )
          created++
        }
      } catch (err) {
        console.error(`Error syncing stage ${stage.name}:`, err)
        errors.push(`Falha ao sincronizar: ${stage.name}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sincronização concluída`,
      created,
      updated,
      total: stages.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error syncing labels:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
