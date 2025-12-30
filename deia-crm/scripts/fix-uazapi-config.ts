import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixConfig() {
  // Buscar dados
  const { data: company } = await supabase
    .from("companies")
    .select("chatwoot_account_id, chatwoot_api_key")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { data: instance } = await supabase
    .from("instances")
    .select("uazapi_token, chatwoot_inbox_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!company || !instance) {
    console.log("Dados não encontrados");
    return;
  }

  console.log("Corrigindo configuração...");
  console.log("- Account ID:", company.chatwoot_account_id);
  console.log("- Inbox ID:", instance.chatwoot_inbox_id);

  const response = await fetch("https://faltech.uazapi.com/chatwoot/config", {
    method: "PUT",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "token": instance.uazapi_token
    },
    body: JSON.stringify({
      enabled: true,
      url: "https://desk.faltechia.com",
      access_token: company.chatwoot_api_key,
      account_id: company.chatwoot_account_id,
      inbox_id: instance.chatwoot_inbox_id,
      ignore_groups: true,
      sign_messages: false,
      create_new_conversation: false
    })
  });

  const data = await response.json();
  console.log("\nResultado:");
  console.log(JSON.stringify(data, null, 2));
}

fixConfig();
