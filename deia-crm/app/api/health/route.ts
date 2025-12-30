import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/health - Health check do sistema
export async function GET() {
  const checks = {
    database: false,
    webhooks: {
      healthy: false,
      pending: 0,
      failed: 0,
      lastProcessed: null as string | null
    },
    timestamp: new Date().toISOString()
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // Check database
    const { error: dbError } = await supabase
      .from('companies')
      .select('id')
      .limit(1)

    checks.database = !dbError

    // Check webhook events
    const { data: webhookStats } = await supabase
      .from('webhook_events')
      .select('status, processed_at')
      .order('processed_at', { ascending: false })
      .limit(100)

    if (webhookStats) {
      const pending = webhookStats.filter(e => e.status === 'pending').length
      const failed = webhookStats.filter(e => e.status === 'failed').length
      const lastProcessed = webhookStats.find(e => e.processed_at)?.processed_at

      checks.webhooks = {
        healthy: failed < 10, // Saudável se menos de 10 falhados recentes
        pending,
        failed,
        lastProcessed
      }
    }

    const isHealthy = checks.database && checks.webhooks.healthy

    return NextResponse.json(
      {
        status: isHealthy ? 'healthy' : 'degraded',
        checks
      },
      { status: isHealthy ? 200 : 503 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        checks,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    )
  }
}
