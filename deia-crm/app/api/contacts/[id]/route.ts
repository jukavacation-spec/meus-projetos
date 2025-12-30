import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyChatwoot, chatwootRequest } from '@/lib/chatwoot/getCompanyChatwoot'

type RouteParams = {
  params: Promise<{ id: string }>
}

// GET - Get contact details
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    const { id } = await context.params

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('company_id', profile.company_id)
      .single()

    if (error || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    return NextResponse.json({ contact })
  } catch (error) {
    console.error('Error fetching contact:', error)
    return NextResponse.json({ error: 'Failed to fetch contact' }, { status: 500 })
  }
}

// PATCH - Update contact
export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    const { id } = await context.params
    const body = await request.json()
    const { name, email } = body

    // Buscar contato existente para pegar chatwoot_contact_id
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('chatwoot_contact_id')
      .eq('id', id)
      .eq('company_id', profile.company_id)
      .single()

    // Validate fields
    const updates: Record<string, string | null> = {}

    if (name !== undefined) {
      updates.name = name?.trim() || null
    }

    if (email !== undefined) {
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }
      updates.email = email?.trim() || null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: contact, error } = await supabase
      .from('contacts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('company_id', profile.company_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating contact:', error)
      return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 })
    }

    // Sincronizar com Chatwoot (fire and forget)
    if (existingContact?.chatwoot_contact_id) {
      getCompanyChatwoot()
        .then(async (result) => {
          if (!result.success) return

          const chatwootUpdates: Record<string, string | null> = {}
          if (updates.name !== undefined) chatwootUpdates.name = updates.name
          if (updates.email !== undefined) chatwootUpdates.email = updates.email

          if (Object.keys(chatwootUpdates).length > 0) {
            await chatwootRequest(
              result.credentials,
              `/contacts/${existingContact.chatwoot_contact_id}`,
              {
                method: 'PUT',
                body: JSON.stringify(chatwootUpdates)
              }
            )
          }
        })
        .catch(() => {
          // Sync falhou silenciosamente - não bloqueia a resposta
        })
    }

    return NextResponse.json({
      success: true,
      message: 'Contato atualizado com sucesso',
      contact
    })
  } catch (error) {
    console.error('Error updating contact:', error)
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 })
  }
}
