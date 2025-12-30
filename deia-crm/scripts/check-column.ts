import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

async function check() {
  // Tentar inserir um convite de teste com chatwoot_agent_id
  // Se a coluna não existir, vai dar erro

  const { data, error } = await supabase
    .from('team_invites')
    .select('id, email, chatwoot_agent_id')
    .limit(1)

  if (error) {
    console.log('Erro ao buscar:', error.message)
    if (error.message.includes('chatwoot_agent_id')) {
      console.log('COLUNA NAO EXISTE - precisa aplicar migration')
    }
  } else {
    console.log('Coluna existe! Dados:', data)
  }
}

check()
