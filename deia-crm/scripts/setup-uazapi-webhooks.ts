/**
 * Script para configurar webhooks da UAZAPI em todas as instâncias
 *
 * Uso:
 * NEXT_PUBLIC_SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." npx tsx scripts/setup-uazapi-webhooks.ts
 */

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const APP_URL = "https://chat.faltechia.com"

async function setupWebhooks() {
  console.log("=== CONFIGURAÇÃO DE WEBHOOKS UAZAPI ===\n")

  // Buscar todas instâncias com uazapi_token
  const { data: instances, error } = await supabase
    .from("instances")
    .select("id, name, uazapi_token, uazapi_instance_name, company_id")
    .not("uazapi_token", "is", null)

  if (error) {
    console.error("Erro ao buscar instâncias:", error.message)
    process.exit(1)
  }

  console.log(`Encontradas ${instances?.length || 0} instâncias com UAZAPI token\n`)

  for (const instance of instances || []) {
    console.log(`--- ${instance.name} ---`)
    console.log(`  Instance Name: ${instance.uazapi_instance_name}`)

    // URL completa com instanceId e token para autenticação
    const webhookUrl = `${APP_URL}/api/webhooks/uazapi?instanceId=${instance.uazapi_instance_name}&token=${instance.uazapi_token}`

    try {
      // Verificar configuração atual
      const getResponse = await fetch("https://faltech.uazapi.com/webhook", {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "token": instance.uazapi_token
        }
      })

      const currentConfig = await getResponse.json()
      console.log(`  Configuração atual:`, currentConfig?.[0]?.enabled ? "Ativo" : "Inativo")

      // Configurar webhook
      const response = await fetch("https://faltech.uazapi.com/webhook", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "token": instance.uazapi_token
        },
        body: JSON.stringify({
          url: webhookUrl,
          enabled: true,
          events: ["messages.upsert", "connection.update"]
        })
      })

      const result = await response.json()

      if (result[0]?.enabled && result[0]?.url === webhookUrl) {
        console.log(`  ✅ Webhook configurado com sucesso`)
        console.log(`  URL: ${webhookUrl.substring(0, 60)}...`)
        console.log(`  Eventos: ${result[0]?.events?.join(", ")}`)
      } else {
        console.log(`  ❌ Falha na configuração:`, JSON.stringify(result))
      }
    } catch (err) {
      console.log(`  ❌ Erro:`, (err as Error).message)
    }

    console.log("")
  }

  console.log("=== CONFIGURAÇÃO CONCLUÍDA ===")
}

setupWebhooks()
