import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

async function check() {
  const { data: invites } = await supabase
    .from('team_invites')
    .select('id, email, token, status, created_at')
    .eq('email', 'faltechia@gmail.com')
    .order('created_at', { ascending: false })
    .limit(5)

  console.log('=== CONVITES PARA faltechia@gmail.com ===')
  for (const inv of invites || []) {
    console.log(`- Status: ${inv.status} | Token: ${inv.token.substring(0, 30)}... | Created: ${inv.created_at}`)
  }
}

check()
