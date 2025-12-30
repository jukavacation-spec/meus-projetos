import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://zuojwdorjklscnbysasm.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Buscar empresa
  const { data: company, error } = await supabase
    .from('companies')
    .select('id, name, chatwoot_account_id, chatwoot_api_key')
    .eq('id', '3088e481-8ad4-4b81-a576-9cc6a91f9f82')
    .single();

  if (error) {
    console.log('ERRO:', error.message);
    return;
  }

  console.log('Empresa:', company.name);
  console.log('Chatwoot Account ID:', company.chatwoot_account_id);
  console.log('Chatwoot API Key:', company.chatwoot_api_key);

  // Testar conexão com Chatwoot usando a API key da empresa
  const CHATWOOT_API_URL = 'https://chat.veratoni.faltechia.com';

  console.log('\n--- Testando API do Chatwoot ---');

  try {
    const response = await fetch(
      `${CHATWOOT_API_URL}/api/v1/accounts/${company.chatwoot_account_id}/conversations?status=all`,
      {
        headers: {
          'api_access_token': company.chatwoot_api_key
        }
      }
    );

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Conexão OK!');
      console.log('Total de conversas:', data.data?.payload?.length || 0);
    } else {
      console.log('❌ Erro:', data.error || data.message);
    }
  } catch (e) {
    console.log('❌ Erro de conexão:', e.message);
  }
}

check().catch(console.error);
