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

  if (!company?.chatwoot_api_key) {
    console.log("Empresa sem Chatwoot configurado");
    return;
  }

  // Buscar conversas no Chatwoot
  const response = await fetch(
    `https://desk.faltechia.com/api/v1/accounts/${company.chatwoot_account_id}/conversations?status=open`,
    { headers: { "api_access_token": company.chatwoot_api_key } }
  );

  const data = await response.json();
  const conversations = data.data?.payload || [];

  console.log("=== SINCRONIZANDO", conversations.length, "CONVERSAS ===\n");

  for (const conv of conversations) {
    const lastMsg = conv.last_non_activity_message;
    let lastMsgPreview = lastMsg?.content || null;

    if (!lastMsgPreview && lastMsg?.attachments?.length > 0) {
      const types: Record<string, string> = {
        image: "Imagem",
        audio: "Audio",
        video: "Video",
        file: "Arquivo"
      };
      lastMsgPreview = types[lastMsg.attachments[0].file_type] || "Anexo";
    }

    const { error } = await supabase
      .from("conversations")
      .update({
        last_message: lastMsgPreview ? (lastMsgPreview.length > 100 ? lastMsgPreview.substring(0, 100) + "..." : lastMsgPreview) : null,
        unread_count: conv.unread_count || 0,
        last_activity_at: new Date(conv.last_activity_at * 1000).toISOString()
      })
      .eq("chatwoot_conversation_id", conv.id)
      .eq("company_id", company.id);

    if (!error) {
      console.log(`#${conv.id}: "${lastMsgPreview?.substring(0, 30) || "null"}" | unread: ${conv.unread_count}`);
    }
  }

  console.log("\n=== SINCRONIZACAO CONCLUIDA ===");
}

syncAll();
