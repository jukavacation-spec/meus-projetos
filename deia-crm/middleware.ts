import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Domínios confiáveis para CSRF (adicionar domínio de produção)
const TRUSTED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean) as string[]

/**
 * Valida Origin header para prevenir CSRF em requisições de mutação
 */
function validateCSRF(request: NextRequest): boolean {
  const method = request.method

  // Apenas validar métodos de mutação
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return true
  }

  // Webhooks são exceção (validados por token/signature)
  if (request.nextUrl.pathname.startsWith('/api/webhooks/')) {
    return true
  }

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // Se não tem origin, verificar referer
  const checkUrl = origin || referer

  if (!checkUrl) {
    // Requisições sem origin/referer (ex: API calls diretos) são permitidas
    // A autenticação por token/session protege esses casos
    return true
  }

  try {
    const url = new URL(checkUrl)
    const originHost = `${url.protocol}//${url.host}`

    // Verificar se origin está na lista de confiáveis
    return TRUSTED_ORIGINS.some(trusted => {
      if (!trusted) return false
      try {
        const trustedUrl = new URL(trusted)
        return `${trustedUrl.protocol}//${trustedUrl.host}` === originHost
      } catch {
        return trusted === originHost
      }
    })
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  // CSRF Protection para endpoints de API
  if (request.nextUrl.pathname.startsWith('/api/')) {
    if (!validateCSRF(request)) {
      console.warn(`[CSRF] Blocked request from untrusted origin: ${request.headers.get('origin')}`)
      return NextResponse.json(
        { error: 'Invalid origin' },
        { status: 403 }
      )
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
