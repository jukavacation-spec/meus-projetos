import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data: conv } = await supabase
    .from("conversations")
    .select("chatwoot_conversation_id, assigned_to, users(name)")
    .eq("chatwoot_conversation_id", 3)
    .single();

  console.log("=== CONVERSA #3 NO BANCO ===");
  console.log("assigned_to:", conv?.assigned_to || "NULL");
  console.log("Nome:", (conv as any)?.users?.name || "Nenhum (desatribuído)");

  const { data: company } = await supabase
    .from("companies")
    .select("chatwoot_account_id, chatwoot_api_key")
    .eq("name", "Veratoni")
    .single();

  const response = await fetch(
    `https://desk.faltechia.com/api/v1/accounts/${company!.chatwoot_account_id}/conversations/3`,
    { headers: { "api_access_token": company!.chatwoot_api_key } }
  );

  const chatwootConv = await response.json();

  console.log("\n=== CONVERSA #3 NO CHATWOOT ===");
  console.log("Assignee:", chatwootConv.meta?.assignee?.name || "NULL (desatribuído)");

  // Resultado
  const bancoDesatribuido = conv?.assigned_to === null || conv?.assigned_to === undefined;
  const chatwootDesatribuido = chatwootConv.meta?.assignee === null || chatwootConv.meta?.assignee === undefined;

  console.log("\n=== RESULTADO ===");
  if (bancoDesatribuido && chatwootDesatribuido) {
    console.log("✅ SINCRONIZADO! Ambos desatribuídos.");
  } else if (bancoDesatribuido === false && chatwootDesatribuido) {
    console.log("❌ DESSINCRONIZADO! Chatwoot desatribuído mas banco ainda tem atribuição.");
  } else {
    console.log("Estado: Banco =", bancoDesatribuido ? "desatribuído" : "atribuído", "| Chatwoot =", chatwootDesatribuido ? "desatribuído" : "atribuído");
  }
}
check();
