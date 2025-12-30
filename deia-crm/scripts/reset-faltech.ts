import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

async function reset() {
  const email = 'faltechia@gmail.com'

  // 1. Buscar o ID do usuário
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (!user) {
    console.log('Usuario nao encontrado')
    return
  }

  console.log('User ID:', user.id)

  // 2. Remover inbox assignments
  const { error: assignError } = await supabase
    .from('agent_inbox_assignments')
    .delete()
    .eq('user_id', user.id)

  console.log('Inbox assignments removidos:', assignError ? assignError.message : 'OK')

  // 3. Limpar o usuario (remover da empresa)
  const { error: updateError } = await supabase
    .from('users')
    .update({
      company_id: null,
      role_id: null,
      chatwoot_agent_id: null,
      is_active: false
    })
    .eq('id', user.id)

  console.log('Usuario limpo:', updateError ? updateError.message : 'OK')

  // 4. Deletar convites antigos para este email
  const { error: deleteInvites } = await supabase
    .from('team_invites')
    .delete()
    .eq('email', email)

  console.log('Convites deletados:', deleteInvites ? deleteInvites.message : 'OK')

  // 5. Verificar estado final
  const { data: finalUser } = await supabase
    .from('users')
    .select('id, email, company_id, role_id, chatwoot_agent_id, is_active')
    .eq('email', email)
    .single()

  console.log('\n=== ESTADO FINAL ===')
  console.log(JSON.stringify(finalUser, null, 2))
}

reset()
