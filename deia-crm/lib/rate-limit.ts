/**
 * Rate Limiter simples baseado em memória
 * Para produção com múltiplas instâncias, considere usar Redis
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// Store em memória (per-instance)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Limpar entradas expiradas periodicamente
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Limpar a cada minuto

interface RateLimitOptions {
  /** Número máximo de requests permitidos */
  limit: number
  /** Janela de tempo em segundos */
  windowSeconds: number
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetAt: number
}

/**
 * Verifica rate limit para um identificador
 * @param identifier - Identificador único (ex: IP, userId, apiKey)
 * @param options - Configurações de rate limit
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  const windowMs = options.windowSeconds * 1000
  const key = identifier

  let entry = rateLimitStore.get(key)

  // Se não existe ou expirou, criar nova entrada
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + windowMs,
    }
    rateLimitStore.set(key, entry)

    return {
      success: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetAt: entry.resetAt,
    }
  }

  // Incrementar contador
  entry.count++

  // Verificar se excedeu o limite
  if (entry.count > options.limit) {
    return {
      success: false,
      limit: options.limit,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  return {
    success: true,
    limit: options.limit,
    remaining: options.limit - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Extrai IP do request (considerando proxies)
 */
export function getClientIP(request: Request): string {
  // Verificar headers de proxy
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  // Fallback
  return 'unknown'
}

/**
 * Presets de rate limit para diferentes endpoints
 */
export const RATE_LIMITS = {
  // APIs públicas/webhooks - mais restritivo
  webhook: { limit: 100, windowSeconds: 60 },

  // APIs autenticadas - moderado
  api: { limit: 60, windowSeconds: 60 },

  // Envio de mensagens - mais restritivo
  sendMessage: { limit: 30, windowSeconds: 60 },

  // Auth endpoints - muito restritivo para prevenir brute force
  auth: { limit: 10, windowSeconds: 60 },

  // API Keys - muito restritivo
  apiKey: { limit: 100, windowSeconds: 60 },
} as const
