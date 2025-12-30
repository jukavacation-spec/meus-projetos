import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Rotas públicas que não precisam de autenticação
  const publicRoutes = ['/login', '/signup', '/auth/callback', '/auth/confirm', '/invite']

  // Rota de sem acesso (precisa de auth mas não de company)
  const isNoAccessRoute = pathname === '/no-access'
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // Rotas de API de webhooks (não precisam de auth de usuário)
  const isWebhookRoute = pathname.startsWith('/api/webhooks')

  // Rotas de API de automação (usam API Key própria)
  const isAutomationRoute = pathname.startsWith('/api/automations')

  // Rotas de API de convite (GET pode ser público para ver info do convite)
  const isInviteApiRoute = pathname.startsWith('/api/team/invite')

  // Rotas que não precisam de company (onboarding)
  const noCompanyRoutes = ['/onboarding', '/api/onboarding']
  const isNoCompanyRoute = noCompanyRoutes.some(route => pathname.startsWith(route))

  if (!user && !isPublicRoute && !isWebhookRoute && !isAutomationRoute && !isInviteApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirecionar usuários logados para home, EXCETO na página de convite
  // (usuários precisam acessar /invite mesmo logados para aceitar o convite)
  const isInvitePage = pathname.startsWith('/invite')
  if (user && isPublicRoute && !isInvitePage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Verificar se usuário autenticado tem company_id
  if (user && !isWebhookRoute && !isAutomationRoute && !isInviteApiRoute && !isPublicRoute && !isInvitePage && !isNoAccessRoute) {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    // Debug: log se houver erro na query
    if (profileError) {
      console.error('[Middleware] Error fetching user profile:', profileError.message)
    }

    // Se não tem company (ou erro na query - pode ser RLS)
    if (!profile?.company_id) {
      // Verificar se tem permissão para onboarding
      let canAccessOnboarding = false

      // Token na URL permite onboarding
      const hasOnboardingToken = request.nextUrl.searchParams.has('token')
      if (hasOnboardingToken) {
        canAccessOnboarding = true
      }

      // Usuário criado recentemente (< 24h) pode fazer onboarding
      if (!canAccessOnboarding) {
        const createdAt = user.created_at
        if (createdAt) {
          const hoursSinceCreation = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
          if (hoursSinceCreation < 24) {
            canAccessOnboarding = true
          }
        }
      }

      // Se está tentando acessar onboarding
      if (isNoCompanyRoute) {
        const isApiRoute = pathname.startsWith('/api/')

        // API de onboarding sempre permitida para usuários logados sem empresa
        if (isApiRoute) {
          return supabaseResponse
        }

        // Se pode fazer onboarding, permite
        if (canAccessOnboarding) {
          return supabaseResponse
        }

        // Sem permissão para onboarding → tela de sem acesso
        const url = request.nextUrl.clone()
        url.pathname = '/no-access'
        return NextResponse.redirect(url)
      }

      // Usuário sem empresa tentando acessar outra rota
      if (canAccessOnboarding) {
        // Pode fazer onboarding → redireciona para lá
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }

      // Não pode fazer onboarding → tela de sem acesso
      const url = request.nextUrl.clone()
      url.pathname = '/no-access'
      return NextResponse.redirect(url)
    }
  }

  // Se está no onboarding mas já tem company, redireciona para dashboard
  if (user && pathname === '/onboarding') {
    const { data: profile } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (profile?.company_id) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
