import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function syncAll() {
  const { data: company } = await supabase
    .from("companies")
    .select("id, chatwoot_account_id, chatwoot_api_key")
    .eq("name", "Veratoni")
    .single();

  if (!company) {
    console.log("Empresa não encontrada");
    return;
  }

  // Buscar conversas no Chatwoot
  const response = await fetch(
    `https://desk.faltechia.com/api/v1/accounts/${company.chatwoot_account_id}/conversations?status=open`,
    { headers: { "api_access_token": company.chatwoot_api_key } }
  );

  const data = await response.json();
  const conversations = data.data?.payload || [];

  console.log("=== SINCRONIZANDO TODAS AS ATRIBUICOES ===\n");
  console.log(`${conversations.length} conversas abertas no Chatwoot\n`);

  let updated = 0;

  for (const conv of conversations) {
    const assigneeId = conv.meta?.assignee?.id || null;

    // Buscar user_id se tiver assignee
    let newAssignedTo: string | null = null;
    if (assigneeId) {
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("company_id", company.id)
        .eq("chatwoot_agent_id", assigneeId)
        .single();
      newAssignedTo = user?.id || null;
    }

    // Atualizar no banco (mesmo se for null - para desatribuir)
    const { data: updatedConv, error } = await supabase
      .from("conversations")
      .update({ assigned_to: newAssignedTo, updated_at: new Date().toISOString() })
      .eq("chatwoot_conversation_id", conv.id)
      .eq("company_id", company.id)
      .select("id, assigned_to");

    if (error) {
      console.log(`Conv #${conv.id}: ERRO - ${error.message}`);
    } else if (updatedConv && updatedConv.length > 0) {
      console.log(`Conv #${conv.id}: assigned_to = ${newAssignedTo || "NULL (desatribuido)"}`);
      updated++;
    } else {
      console.log(`Conv #${conv.id}: não encontrada no banco`);
    }
  }

  console.log(`\n=== ${updated} conversas atualizadas ===`);
}

syncAll();
