import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const UAZAPI_URL = "https://faltech.uazapi.com";
const UAZAPI_MASTER_TOKEN = "2IEYlU7bwHap5oPsPR3lSyugWdf3lt5JhYnJRkxCZpHpOAEJsc";
const CHATWOOT_API_URL = "https://desk.faltechia.com";
const CHATWOOT_PLATFORM_TOKEN = "ZqSH7m8Bv1XkCaw4HJFFXU3r";

async function deleteUser() {
  const userId = "d6077132-079d-4ee3-bdf6-b28509560e4b";
  const companyId = "c58cc14b-2145-4477-b34c-4af8df97571f";
  const chatwootAccountId = 5;
  const uazapiInstanceName = "c58cc14b-particular-1766243947560";
  const uazapiToken = "14f03283-8cff-4dd0-a6fe-bba7a36d36fb";

  console.log("=== DELETANDO JULIANO COSTA ===\n");

  // 1. Deletar instância do UAZAPI
  console.log("1. Deletando instância do UAZAPI...");
  try {
    const uazapiResponse = await fetch(`${UAZAPI_URL}/instance/delete`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "admintoken": UAZAPI_MASTER_TOKEN,
      },
      body: JSON.stringify({ name: uazapiInstanceName }),
    });

    if (uazapiResponse.ok) {
      console.log("   ✅ Instância UAZAPI deletada");
    } else {
      const error = await uazapiResponse.text();
      console.log("   ⚠️ UAZAPI:", error);
    }
  } catch (e) {
    console.log("   ❌ Erro UAZAPI:", e);
  }

  // 2. Deletar Account do Chatwoot
  console.log("\n2. Deletando Account do Chatwoot...");
  try {
    const chatwootResponse = await fetch(
      `${CHATWOOT_API_URL}/platform/api/v1/accounts/${chatwootAccountId}`,
      {
        method: "DELETE",
        headers: {
          "api_access_token": CHATWOOT_PLATFORM_TOKEN,
        },
      }
    );

    if (chatwootResponse.ok || chatwootResponse.status === 204) {
      console.log("   ✅ Account Chatwoot deletada");
    } else {
      const error = await chatwootResponse.text();
      console.log("   ⚠️ Chatwoot:", error);
    }
  } catch (e) {
    console.log("   ❌ Erro Chatwoot:", e);
  }

  // 3. Deletar dados do Supabase (ordem correta para respeitar foreign keys)
  console.log("\n3. Deletando dados do Supabase...");

  // 3.1 Deletar instâncias
  const { error: instError } = await supabase
    .from("instances")
    .delete()
    .eq("company_id", companyId);
  console.log(instError ? `   ❌ instances: ${instError.message}` : "   ✅ instances deletadas");

  // 3.2 Deletar conversations
  const { error: convError } = await supabase
    .from("conversations")
    .delete()
    .eq("company_id", companyId);
  console.log(convError ? `   ❌ conversations: ${convError.message}` : "   ✅ conversations deletadas");

  // 3.3 Deletar contacts
  const { error: contactError } = await supabase
    .from("contacts")
    .delete()
    .eq("company_id", companyId);
  console.log(contactError ? `   ❌ contacts: ${contactError.message}` : "   ✅ contacts deletados");

  // 3.4 Deletar kanban_stages
  const { error: kanbanError } = await supabase
    .from("kanban_stages")
    .delete()
    .eq("company_id", companyId);
  console.log(kanbanError ? `   ❌ kanban_stages: ${kanbanError.message}` : "   ✅ kanban_stages deletados");

  // 3.5 Deletar team_invites
  const { error: inviteError } = await supabase
    .from("team_invites")
    .delete()
    .eq("company_id", companyId);
  console.log(inviteError ? `   ❌ team_invites: ${inviteError.message}` : "   ✅ team_invites deletados");

  // 3.6 Deletar quick_replies
  const { error: qrError } = await supabase
    .from("quick_replies")
    .delete()
    .eq("user_id", userId);
  console.log(qrError ? `   ❌ quick_replies: ${qrError.message}` : "   ✅ quick_replies deletadas");

  // 3.7 Deletar user da tabela users
  const { error: userError } = await supabase
    .from("users")
    .delete()
    .eq("id", userId);
  console.log(userError ? `   ❌ users: ${userError.message}` : "   ✅ user deletado da tabela users");

  // 3.8 Deletar roles
  const { error: rolesError } = await supabase
    .from("roles")
    .delete()
    .eq("company_id", companyId);
  console.log(rolesError ? `   ❌ roles: ${rolesError.message}` : "   ✅ roles deletados");

  // 3.9 Deletar company
  const { error: companyError } = await supabase
    .from("companies")
    .delete()
    .eq("id", companyId);
  console.log(companyError ? `   ❌ companies: ${companyError.message}` : "   ✅ company deletada");

  // 3.10 Deletar do Auth
  console.log("\n4. Deletando do Supabase Auth...");
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  console.log(authError ? `   ❌ auth: ${authError.message}` : "   ✅ user deletado do Auth");

  console.log("\n=== CONCLUÍDO ===");
  console.log("Email juliano@veratoni.com.br está livre para novo cadastro.");
}

deleteUser();
