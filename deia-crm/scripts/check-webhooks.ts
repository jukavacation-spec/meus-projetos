import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function checkWebhooks() {
  // Buscar empresa mais recente com chatwoot configurado
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, chatwoot_account_id, chatwoot_api_key")
    .not("chatwoot_account_id", "is", null)
    .order("created_at", { ascending: false });

  if (!companies || companies.length === 0) {
    console.log("Nenhuma empresa com Chatwoot configurado");
    return;
  }

  for (const company of companies) {
    console.log("\n=== Empresa:", company.name, "| Account ID:", company.chatwoot_account_id, "===");

    if (!company.chatwoot_api_key) {
      console.log("  Sem API key");
      continue;
    }

    // Verificar webhooks configurados
    const response = await fetch(
      `https://desk.faltechia.com/api/v1/accounts/${company.chatwoot_account_id}/webhooks`,
      {
        headers: { "api_access_token": company.chatwoot_api_key }
      }
    );

    if (response.ok) {
      const webhooks = await response.json();
      console.log("  Webhooks:", JSON.stringify(webhooks, null, 2));
    } else {
      console.log("  Erro ao buscar webhooks:", response.status, await response.text());
    }
  }
}

checkWebhooks();
