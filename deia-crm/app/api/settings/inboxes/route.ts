import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Buscar configurações de inbox da empresa
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Buscar company_id do usuário
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User has no company' }, { status: 400 })
    }

    // Buscar configurações de inbox
    const { data: settings, error } = await supabase
      .from('company_inbox_settings')
      .select('chatwoot_inbox_id, is_active')
      .eq('company_id', userData.company_id)

    if (error) {
      console.error('Error fetching inbox settings:', error)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    // Retornar como objeto { inbox_id: is_active }
    const settingsMap: Record<number, boolean> = {}
    for (const s of settings || []) {
      settingsMap[s.chatwoot_inbox_id] = s.is_active
    }

    return NextResponse.json({ settings: settingsMap })
  } catch (error) {
    console.error('Error in GET /api/settings/inboxes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Atualizar configuração de uma inbox
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Buscar company_id do usuário
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User has no company' }, { status: 400 })
    }

    const body = await request.json()
    const { inboxId, isActive } = body

    if (typeof inboxId !== 'number' || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Upsert configuração
    const { error } = await supabase
      .from('company_inbox_settings')
      .upsert({
        company_id: userData.company_id,
        chatwoot_inbox_id: inboxId,
        is_active: isActive,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'company_id,chatwoot_inbox_id'
      })

    if (error) {
      console.error('Error updating inbox setting:', error)
      return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
    }

    return NextResponse.json({ success: true, inboxId, isActive })
  } catch (error) {
    console.error('Error in PUT /api/settings/inboxes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
