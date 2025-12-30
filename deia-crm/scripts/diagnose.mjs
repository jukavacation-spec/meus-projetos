import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://zuojwdorjklscnbysasm.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
  console.log('=== DIAGNÓSTICO DO USUÁRIO juliano@veratoni.com.br ===\n');

  // 1. Buscar usuário
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, name, company_id')
    .eq('email', 'juliano@veratoni.com.br')
    .single();

  console.log('1. USUÁRIO:');
  if (userError) {
    console.log('   ERRO:', userError.message);
    return;
  }
  console.log('   Email:', user.email);
  console.log('   Company ID:', user.company_id || 'NULL ❌');

  if (!user.company_id) {
    console.log('\n❌ PROBLEMA: Usuário não está associado a nenhuma empresa!');
    return;
  }

  // 2. Buscar empresa
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name, chatwoot_account_id, chatwoot_api_key')
    .eq('id', user.company_id)
    .single();

  console.log('\n2. EMPRESA:');
  if (companyError) {
    console.log('   ERRO:', companyError.message);
    return;
  }
  console.log('   Nome:', company.name);
  console.log('   Chatwoot Account ID:', company.chatwoot_account_id || 'NULL ❌');
  console.log('   Chatwoot API Key:', company.chatwoot_api_key ? '✅ Configurada' : 'NULL ❌');

  // 3. Buscar instâncias
  const { data: instances, error: instancesError } = await supabase
    .from('instances')
    .select('id, name, uazapi_instance_name, uazapi_status, chatwoot_inbox_id')
    .eq('company_id', user.company_id);

  console.log('\n3. INSTÂNCIAS WHATSAPP:');
  if (instancesError) {
    console.log('   ERRO:', instancesError.message);
  } else if (instances.length === 0) {
    console.log('   Nenhuma instância registrada ❌');
  } else {
    instances.forEach(i => {
      console.log('   -', i.name, '| UAZAPI:', i.uazapi_instance_name, '| Status:', i.uazapi_status, '| Inbox Chatwoot:', i.chatwoot_inbox_id || 'NULL');
    });
  }

  // 4. Buscar conversas
  const { data: conversations, error: convsError } = await supabase
    .from('conversations')
    .select('id, status, chatwoot_conversation_id')
    .eq('company_id', user.company_id);

  console.log('\n4. CONVERSAS:');
  if (convsError) {
    console.log('   ERRO:', convsError.message);
  } else {
    console.log('   Total:', conversations.length);
    console.log('   Com Chatwoot ID:', conversations.filter(c => c.chatwoot_conversation_id).length);
    console.log('   Sem Chatwoot ID:', conversations.filter(c => !c.chatwoot_conversation_id).length);
  }

  // 5. Buscar contatos
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('id, chatwoot_contact_id')
    .eq('company_id', user.company_id);

  console.log('\n5. CONTATOS:');
  if (contactsError) {
    console.log('   ERRO:', contactsError.message);
  } else {
    console.log('   Total:', contacts.length);
    console.log('   Com Chatwoot ID:', contacts.filter(c => c.chatwoot_contact_id).length);
  }

  console.log('\n=== FIM DO DIAGNÓSTICO ===');
}

diagnose().catch(console.error);
