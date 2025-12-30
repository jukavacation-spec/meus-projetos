import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function getLastUser() {
  // Buscar último usuário criado
  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, company_id, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("=== ÚLTIMOS USUÁRIOS ===");
  for (const u of users || []) {
    console.log(`- ${u.name} (${u.email})`);
    console.log(`  ID: ${u.id}`);
    console.log(`  Company: ${u.company_id}`);
    console.log(`  Criado: ${u.created_at}`);
    console.log("");
  }

  if (users && users[0]?.company_id) {
    // Buscar dados da empresa
    const { data: company } = await supabase
      .from("companies")
      .select("id, name, chatwoot_account_id")
      .eq("id", users[0].company_id)
      .single();

    console.log("=== EMPRESA DO ÚLTIMO USUÁRIO ===");
    console.log(JSON.stringify(company, null, 2));

    // Buscar instâncias
    const { data: instances } = await supabase
      .from("instances")
      .select("id, name, uazapi_instance_name, uazapi_token, chatwoot_inbox_id")
      .eq("company_id", users[0].company_id);

    console.log("\n=== INSTÂNCIAS ===");
    console.log(JSON.stringify(instances, null, 2));
  }
}

getLastUser();
