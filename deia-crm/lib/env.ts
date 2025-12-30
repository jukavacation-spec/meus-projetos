// Validação de variáveis de ambiente
// Este arquivo deve ser importado no início da aplicação

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

const requiredInProduction = [
  'CHATWOOT_WEBHOOK_SECRET',
] as const

type EnvVar = (typeof requiredEnvVars)[number]
type ProdEnvVar = (typeof requiredInProduction)[number]

function getEnvVar(name: EnvVar | ProdEnvVar): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`)
  }
  return value
}

function validateEnv() {
  const missing: string[] = []

  // Verificar variáveis obrigatórias
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar)
    }
  }

  // Verificar variáveis obrigatórias apenas em produção
  if (process.env.NODE_ENV === 'production') {
    for (const envVar of requiredInProduction) {
      if (!process.env[envVar]) {
        missing.push(envVar)
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}`
    )
  }
}

// Validar ao importar o módulo
validateEnv()

// Exportar variáveis tipadas
export const env = {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,

  // Chatwoot
  CHATWOOT_API_URL: process.env.CHATWOOT_API_URL || '',
  CHATWOOT_API_KEY: process.env.CHATWOOT_API_KEY || '',
  CHATWOOT_WEBHOOK_SECRET: process.env.CHATWOOT_WEBHOOK_SECRET || '',
  CHATWOOT_PLATFORM_TOKEN: process.env.CHATWOOT_PLATFORM_TOKEN || '',

  // UAZAPI
  UAZAPI_URL: process.env.UAZAPI_URL || '',
  UAZAPI_MASTER_TOKEN: process.env.UAZAPI_MASTER_TOKEN || '',

  // App
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

  // Email
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'DEIA CRM <noreply@example.com>',

  // Helpers
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
} as const

export { getEnvVar, validateEnv }
