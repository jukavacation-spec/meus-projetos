import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CHATWOOT_API_URL = process.env.CHATWOOT_API_URL

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticacao
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verificar se deve filtrar por permissões do agente
    const { searchParams } = new URL(request.url)
    const filterByAgent = searchParams.get('filterByAgent') !== 'false' // default: true

    // Buscar usuario e empresa com credenciais Chatwoot
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json(
        { error: 'User has no company' },
        { status: 400 }
      )
    }

    const { data: company } = await supabase
      .from('companies')
      .select('chatwoot_account_id, chatwoot_api_key')
      .eq('id', userData.company_id)
      .single()

    if (!company?.chatwoot_account_id || !company?.chatwoot_api_key) {
      return NextResponse.json(
        { error: 'Company has no Chatwoot configuration' },
        { status: 400 }
      )
    }

    // Buscar inboxes usando as credenciais da empresa
    const response = await fetch(
      `${CHATWOOT_API_URL}/api/v1/accounts/${company.chatwoot_account_id}/inboxes`,
      {
        headers: {
          'api_access_token': company.chatwoot_api_key,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Chatwoot API error: ${response.status}`)
    }

    const data = await response.json()
    let inboxes = data.payload || []

    // Transform to a cleaner format
    let transformedInboxes = inboxes.map((inbox: {
      id: number
      name: string
      channel_type: string
      avatar_url: string | null
      phone_number: string | null
    }) => ({
      id: inbox.id,
      name: inbox.name,
      channel_type: inbox.channel_type,
      avatar_url: inbox.avatar_url,
      phone_number: inbox.phone_number,
    }))

    // Filtrar por permissões do agente se necessário
    if (filterByAgent) {
      // Verificar se o usuário é owner ou admin (não precisa filtrar)
      const { data: userRole } = await supabase
        .from('roles')
        .select('name')
        .eq('id', userData.role_id)
        .single()

      const isAdminOrOwner = userRole?.name === 'owner' || userRole?.name === 'admin'

      console.log('[Inboxes API] User:', user.id, 'Role:', userRole?.name, 'isAdminOrOwner:', isAdminOrOwner)

      if (!isAdminOrOwner) {
        // Buscar atribuições de inbox do agente
        const { data: assignments } = await supabase
          .from('agent_inbox_assignments')
          .select('chatwoot_inbox_id')
          .eq('user_id', user.id)

        console.log('[Inboxes API] Assignments for user:', assignments)

        // Se o agente tem atribuições, filtrar as inboxes
        if (assignments && assignments.length > 0) {
          const allowedInboxIds = assignments.map(a => a.chatwoot_inbox_id)
          console.log('[Inboxes API] Filtering to inbox IDs:', allowedInboxIds)
          transformedInboxes = transformedInboxes.filter(
            (inbox: { id: number }) => allowedInboxIds.includes(inbox.id)
          )
          console.log('[Inboxes API] Filtered inboxes count:', transformedInboxes.length)
        }
        // Se não tem atribuições, não mostra nenhuma inbox (segurança)
        // A menos que seja um agente novo que ainda não foi configurado
        // Neste caso, vamos verificar se existem atribuições para qualquer agente
        else {
          const { data: anyAssignments } = await supabase
            .from('agent_inbox_assignments')
            .select('id')
            .eq('company_id', userData.company_id)
            .limit(1)

          // Se existem atribuições na empresa mas o agente não tem nenhuma, ele não vê nada
          if (anyAssignments && anyAssignments.length > 0) {
            console.log('[Inboxes API] Agent has no assignments but company has some. Showing empty.')
            transformedInboxes = []
          }
          // Se não existem atribuições na empresa, todos veem tudo (compatibilidade)
        }
      }
    }

    return NextResponse.json({ inboxes: transformedInboxes })
  } catch (error) {
    console.error('Error fetching inboxes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inboxes' },
      { status: 500 }
    )
  }
}
