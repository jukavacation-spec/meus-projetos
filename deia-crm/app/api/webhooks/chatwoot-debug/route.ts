import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })
}

// Endpoint para debug - salva TODOS os payloads recebidos
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const supabase = getSupabaseAdmin()

    // Log completo no console
    console.log('[DEBUG WEBHOOK] FULL PAYLOAD:', JSON.stringify(payload, null, 2))

    // Salvar em uma tabela para análise (se existir)
    // Por enquanto, apenas retorna o payload recebido

    return NextResponse.json({
      received: true,
      event: payload.event,
      conversation_id: payload.conversation?.id,
      has_assignee: !!payload.conversation?.assignee,
      has_meta_assignee: !!payload.conversation?.meta?.assignee,
      changed_attributes: payload.conversation?.changed_attributes,
    })
  } catch (error) {
    console.error('[DEBUG WEBHOOK] Error:', error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
