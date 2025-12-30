import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const CHATWOOT_URL = "https://desk.faltechia.com";
const WEBHOOK_URL = "https://chat.faltechia.com/api/webhooks/chatwoot";
const SUBSCRIPTIONS = [
  "conversation_created",
  "conversation_status_changed",
  "conversation_updated",
  "message_created",
  "message_updated",
  "webwidget_triggered",
  "contact_created",
  "contact_updated",
  "conversation_typing_on",
  "conversation_typing_off",
];

async function fixWebhooks() {
  // Buscar empresas com chatwoot configurado
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, chatwoot_account_id, chatwoot_api_key")
    .not("chatwoot_account_id", "is", null);

  if (!companies || companies.length === 0) {
    console.log("Nenhuma empresa com Chatwoot configurado");
    return;
  }

  for (const company of companies) {
    console.log("\n=== Empresa:", company.name, "| Account ID:", company.chatwoot_account_id, "===");

    if (!company.chatwoot_api_key) {
      console.log("  Sem API key - pulando");
      continue;
    }

    // Buscar webhooks existentes
    const listResponse = await fetch(
      `${CHATWOOT_URL}/api/v1/accounts/${company.chatwoot_account_id}/webhooks`,
      {
        headers: { "api_access_token": company.chatwoot_api_key }
      }
    );

    if (!listResponse.ok) {
      console.log("  Erro ao buscar webhooks:", listResponse.status);
      continue;
    }

    const data = await listResponse.json();
    const webhooks = data.payload?.webhooks || [];

    // Verificar se já existe webhook correto
    const correctWebhook = webhooks.find((w: { url: string }) => w.url === WEBHOOK_URL);

    if (correctWebhook) {
      console.log("  ✅ Webhook já configurado corretamente");
      continue;
    }

    // Deletar webhooks incorretos (localhost)
    for (const webhook of webhooks) {
      if (webhook.url.includes("localhost")) {
        console.log("  Deletando webhook incorreto:", webhook.url);
        await fetch(
          `${CHATWOOT_URL}/api/v1/accounts/${company.chatwoot_account_id}/webhooks/${webhook.id}`,
          {
            method: "DELETE",
            headers: { "api_access_token": company.chatwoot_api_key }
          }
        );
      }
    }

    // Criar webhook correto
    console.log("  Criando webhook:", WEBHOOK_URL);
    const createResponse = await fetch(
      `${CHATWOOT_URL}/api/v1/accounts/${company.chatwoot_account_id}/webhooks`,
      {
        method: "POST",
        headers: {
          "api_access_token": company.chatwoot_api_key,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          subscriptions: SUBSCRIPTIONS
        })
      }
    );

    if (createResponse.ok) {
      const created = await createResponse.json();
      console.log("  ✅ Webhook criado:", created.payload?.webhook?.id || created.id);
    } else {
      console.log("  ❌ Erro ao criar webhook:", createResponse.status, await createResponse.text());
    }
  }

  console.log("\n=== Concluído ===");
}

fixWebhooks();
