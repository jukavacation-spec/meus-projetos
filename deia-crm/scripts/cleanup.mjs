import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zuojwdorjklscnbysasm.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY não configurada')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function cleanup() {
  const userId = 'b41c5450-9a03-45a1-8b33-7ff12238b2ba'
  const companyId = '5eff74e8-b41d-4650-8d53-604db0df1d7d'

  console.log('Deletando instances...')
  const { error: e1 } = await supabase.from('instances').delete().eq('company_id', companyId)
  if (e1) console.error('Instances error:', e1)

  console.log('Deletando roles...')
  const { error: e2 } = await supabase.from('roles').delete().eq('company_id', companyId)
  if (e2) console.error('Roles error:', e2)

  console.log('Atualizando user (removendo company)...')
  const { error: e3 } = await supabase.from('users').update({ company_id: null, role_id: null }).eq('id', userId)
  if (e3) console.error('User update error:', e3)

  console.log('Deletando company...')
  const { error: e4 } = await supabase.from('companies').delete().eq('id', companyId)
  if (e4) console.error('Company error:', e4)

  console.log('Deletando user da tabela users...')
  const { error: e5 } = await supabase.from('users').delete().eq('id', userId)
  if (e5) console.error('User delete error:', e5)

  console.log('Deletando user do Auth...')
  const { error: e6 } = await supabase.auth.admin.deleteUser(userId)
  if (e6) console.error('Auth delete error:', e6)

  console.log('Cleanup completo!')
}

cleanup().catch(console.error)
