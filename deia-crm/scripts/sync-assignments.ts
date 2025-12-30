import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function syncAssignments() {
  // Buscar empresa Veratoni
  const { data: company } = await supabase
    .from("companies")
    .select("id, chatwoot_account_id, chatwoot_api_key")
    .eq("name", "Veratoni")
    .single();

  if (!company) {
    console.log("Empresa não encontrada");
    return;
  }

  console.log("=== SINCRONIZANDO ATRIBUIÇÕES ===\n");
  console.log("Empresa:", company.id);
  console.log("Chatwoot Account:", company.chatwoot_account_id);

  // Buscar conversas abertas no Chatwoot
  const response = await fetch(
    `https://desk.faltechia.com/api/v1/accounts/${company.chatwoot_account_id}/conversations?status=open`,
    {
      headers: { "api_access_token": company.chatwoot_api_key }
    }
  );

  const data = await response.json();
  const conversations = data.data?.payload || [];

  console.log("\nConversas abertas no Chatwoot:", conversations.length);

  let updated = 0;

  for (const conv of conversations) {
    const assigneeId = conv.meta?.assignee?.id;
    const assigneeName = conv.meta?.assignee?.name;

    console.log(`\nConv #${conv.id}: Assignee = ${assigneeName || "Nenhum"} (ID: ${assigneeId || "null"})`);

    if (!assigneeId) continue;

    // Buscar user pelo chatwoot_agent_id
    const { data: user } = await supabase
      .from("users")
      .select("id, name")
      .eq("company_id", company.id)
      .eq("chatwoot_agent_id", assigneeId)
      .single();

    if (!user) {
      console.log(`  -> User com chatwoot_agent_id=${assigneeId} não encontrado`);
      continue;
    }

    console.log(`  -> User encontrado: ${user.name} (${user.id})`);

    // Atualizar no banco
    const { data: updatedConv, error } = await supabase
      .from("conversations")
      .update({ assigned_to: user.id, updated_at: new Date().toISOString() })
      .eq("chatwoot_conversation_id", conv.id)
      .eq("company_id", company.id)
      .select("id");

    if (error) {
      console.log(`  -> Erro ao atualizar: ${error.message}`);
    } else if (updatedConv && updatedConv.length > 0) {
      console.log(`  -> Atualizado com sucesso!`);
      updated++;
    } else {
      console.log(`  -> Conversa não encontrada no banco local`);
    }
  }

  console.log(`\n=== RESULTADO ===`);
  console.log(`${updated} conversas atualizadas`);
}

syncAssignments();
