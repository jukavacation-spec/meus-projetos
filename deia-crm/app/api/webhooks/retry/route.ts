import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })
}

// POST /api/webhooks/retry - Reprocessa eventos falhados
export async function POST(req: NextRequest) {
  try {
    // Verificar autenticação (apenas admins podem chamar)
    const authHeader = req.headers.get('authorization')
    const expectedToken = process.env.WEBHOOK_RETRY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()

    // Buscar eventos falhados que ainda podem ser reprocessados
    const { data: failedEvents, error: fetchError } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('status', 'failed')
      .lt('attempts', 3) // Máximo 3 tentativas
      .order('created_at', { ascending: true })
      .limit(50)

    if (fetchError) {
      console.error('[Retry] Error fetching events:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
    }

    if (!failedEvents || failedEvents.length === 0) {
      return NextResponse.json({ message: 'No events to retry', processed: 0 })
    }

    let processed = 0
    let succeeded = 0
    let failed = 0

    for (const event of failedEvents) {
      try {
        // Marcar como processing
        await supabase
          .from('webhook_events')
          .update({
            status: 'processing',
            attempts: event.attempts + 1
          })
          .eq('id', event.id)

        // Reprocessar o evento chamando o webhook interno
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/${event.source}`

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event.payload)
        })

        if (response.ok) {
          // Evento já será marcado como completed pelo webhook
          succeeded++
        } else {
          // Marcar como falho novamente
          await supabase
            .from('webhook_events')
            .update({
              status: 'failed',
              last_error: `HTTP ${response.status}: ${await response.text()}`
            })
            .eq('id', event.id)
          failed++
        }

        processed++
      } catch (err) {
        // Marcar como falho
        await supabase
          .from('webhook_events')
          .update({
            status: 'failed',
            last_error: err instanceof Error ? err.message : 'Unknown error'
          })
          .eq('id', event.id)
        failed++
        processed++
      }
    }

    return NextResponse.json({
      message: 'Retry completed',
      processed,
      succeeded,
      failed,
      remaining: failedEvents.length - processed
    })
  } catch (error) {
    console.error('[Retry] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// GET /api/webhooks/retry - Status dos eventos
export async function GET(req: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = req.headers.get('authorization')
    const expectedToken = process.env.WEBHOOK_RETRY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()

    // Estatísticas dos eventos
    const { data: stats } = await supabase
      .from('webhook_events')
      .select('status')

    const statusCounts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0
    }

    if (stats) {
      for (const event of stats) {
        statusCounts[event.status as keyof typeof statusCounts]++
        statusCounts.total++
      }
    }

    // Últimos eventos falhados
    const { data: recentFailed } = await supabase
      .from('webhook_events')
      .select('id, event_type, last_error, attempts, created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      status: 'healthy',
      stats: statusCounts,
      recentFailed: recentFailed || []
    })
  } catch (error) {
    console.error('[Retry Status] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
