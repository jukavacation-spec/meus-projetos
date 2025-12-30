import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

async function check() {
  const email = 'faltechia@gmail.com'

  // 1. Verificar usuário na tabela users
  const { data: user } = await supabase
    .from('users')
    .select('id, name, email, company_id, role_id, is_active, chatwoot_agent_id')
    .eq('email', email)
    .single()

  console.log('=== USUARIO TABELA USERS ===')
  console.log(JSON.stringify(user, null, 2))

  // 2. Verificar no Auth
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const authUser = authUsers?.users.find(u => u.email === email)

  console.log('\n=== USUARIO NO AUTH ===')
  if (authUser) {
    console.log('ID:', authUser.id)
    console.log('Email:', authUser.email)
    console.log('Confirmed:', authUser.email_confirmed_at ? 'Sim' : 'Nao')
  } else {
    console.log('NAO EXISTE NO AUTH')
  }

  // 3. Verificar convites
  const { data: invites } = await supabase
    .from('team_invites')
    .select('id, email, status, token, created_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(3)

  console.log('\n=== CONVITES ===')
  if (!invites || invites.length === 0) {
    console.log('NENHUM CONVITE ENCONTRADO')
  } else {
    for (const inv of invites) {
      const shortToken = inv.token.slice(0, 30)
      console.log('Status:', inv.status, '| Token:', shortToken + '...')
    }
  }
}

check()
