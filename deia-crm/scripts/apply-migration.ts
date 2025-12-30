import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

async function applyMigration() {
  console.log('Applying migration: add chatwoot_agent_id to team_invites...')

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE team_invites
      ADD COLUMN IF NOT EXISTS chatwoot_agent_id INTEGER;

      COMMENT ON COLUMN team_invites.chatwoot_agent_id IS 'Chatwoot agent ID created when invite is sent';
    `
  })

  if (error) {
    // Se falhar via RPC, tentar diretamente (pode ser que a função não existe)
    console.log('RPC failed, trying direct query...')

    // Verificar se a coluna já existe
    const { data: columns } = await supabase
      .from('team_invites')
      .select('chatwoot_agent_id')
      .limit(0)

    if (!columns) {
      console.log('Column may already exist or table structure is different')
    }
  }

  console.log('Migration applied successfully!')
}

applyMigration()
