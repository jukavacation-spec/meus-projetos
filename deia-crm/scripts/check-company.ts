import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

async function check() {
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, chatwoot_account_id, chatwoot_api_key')
    .eq('id', '9ced4f64-2dff-42d8-9242-ae252f069fdf')
    .single()

  console.log('=== EMPRESA ===')
  console.log('ID:', company?.id)
  console.log('Nome:', company?.name)
  console.log('Chatwoot Account ID:', company?.chatwoot_account_id || 'NAO CONFIGURADO')
  console.log('Chatwoot API Key:', company?.chatwoot_api_key ? company.chatwoot_api_key.substring(0, 20) + '...' : 'NAO CONFIGURADO')
}

check()
