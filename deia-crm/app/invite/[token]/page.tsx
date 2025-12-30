'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle2, XCircle, Mail, Building2, Shield, UserPlus } from 'lucide-react'

type InviteData = {
  id: string
  email: string
  expires_at: string
  company: { name: string }
  role: { display_name: string }
  inviter: { name: string | null; email: string }
}

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [invite, setInvite] = useState<InviteData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)

  // Form de cadastro
  const [signupName, setSignupName] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [userExists, setUserExists] = useState(false) // Usuario ja existe no sistema

  // Form de login (para usuarios existentes)
  const [loginPassword, setLoginPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)

  useEffect(() => {
    async function fetchInvite() {
      try {
        const response = await fetch(`/api/team/invite/accept?token=${token}`)
        const data = await response.json()

        if (!data.success) {
          setError(data.error || 'Convite invalido')
          return
        }

        setInvite(data.invite)

        // Verificar se usuario ja existe no sistema
        if (data.userExists) {
          setUserExists(true)
        }

        // Verificar se usuario esta logado
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          setIsLoggedIn(true)
          setCurrentUserEmail(user.email || null)
        }
      } catch {
        setError('Erro ao carregar convite')
      } finally {
        setIsLoading(false)
      }
    }

    if (token) {
      fetchInvite()
    }
  }, [token])

  const handleAccept = async () => {
    setIsAccepting(true)
    try {
      const response = await fetch('/api/team/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (data.success) {
        router.push('/?welcome=true')
      } else {
        setError(data.error || 'Erro ao aceitar convite')
      }
    } catch {
      setError('Erro ao aceitar convite')
    } finally {
      setIsAccepting(false)
    }
  }

  const handleSignup = async () => {
    if (!invite) return

    setIsSigningUp(true)
    setError(null)

    try {
      // Usar nova API que cria usuario, aceita convite e retorna sessao
      const response = await fetch('/api/team/invite/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: signupName,
          password: signupPassword,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Erro ao criar conta')
        return
      }

      // Fazer login com as credenciais após signup bem-sucedido
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email || invite.email,
        password: signupPassword,
      })

      if (signInError) {
        // Mesmo com erro no login, a conta foi criada
        // Redirecionar para página de login
        router.push('/login?message=Conta criada! Faça login para continuar.')
        return
      }

      // Redirecionar para home
      router.push('/?welcome=true')
    } catch {
      setError('Erro ao criar conta')
    } finally {
      setIsSigningUp(false)
    }
  }

  // Login para usuarios existentes
  const handleLogin = async () => {
    if (!invite) return

    setIsLoggingIn(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password: loginPassword,
      })

      if (signInError) {
        setError('Senha incorreta. Tente novamente.')
        return
      }

      // Apos login, aceitar o convite
      const response = await fetch('/api/team/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (data.success) {
        router.push('/?welcome=true')
      } else {
        setError(data.error || 'Erro ao aceitar convite')
      }
    } catch {
      setError('Erro ao fazer login')
    } finally {
      setIsLoggingIn(false)
    }
  }

  // Recuperar senha
  const handleForgotPassword = async () => {
    if (!invite) return

    setIsResettingPassword(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(invite.email, {
        redirectTo: `${window.location.origin}/invite/${token}`,
      })

      if (resetError) {
        setError('Erro ao enviar email de recuperacao. Tente novamente.')
        return
      }

      setResetEmailSent(true)
    } catch {
      setError('Erro ao enviar email de recuperacao')
    } finally {
      setIsResettingPassword(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Carregando convite...</p>
        </div>
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Convite Invalido</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => router.push('/login')}>
                Ir para Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!invite) return null

  const isExpired = new Date(invite.expires_at) < new Date()

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Convite Expirado</h2>
              <p className="text-muted-foreground mb-4">
                Este convite expirou. Solicite um novo convite ao administrador.
              </p>
              <Button onClick={() => router.push('/login')}>
                Ir para Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Voce foi convidado!</CardTitle>
          <CardDescription>
            {invite.inviter.name || invite.inviter.email} convidou voce para fazer parte da equipe
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Informacoes do convite */}
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Empresa</p>
                <p className="font-medium">{invite.company.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Cargo</p>
                <p className="font-medium">{invite.role.display_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{invite.email}</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Acoes baseadas no estado de autenticacao */}
          {isLoggedIn ? (
            currentUserEmail?.toLowerCase() === invite.email.toLowerCase() ? (
              <Button
                className="w-full"
                size="lg"
                onClick={handleAccept}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aceitando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Aceitar Convite
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-orange-600 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                  Voce esta logado como <strong>{currentUserEmail}</strong>, mas o convite e para <strong>{invite.email}</strong>.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const supabase = createClient()
                    supabase.auth.signOut().then(() => {
                      window.location.reload()
                    })
                  }}
                >
                  Sair e usar outro email
                </Button>
              </div>
            )
          ) : userExists ? (
            // Usuario ja existe - mostrar formulario de login
            <div className="space-y-4">
              {resetEmailSent ? (
                <div className="text-center space-y-3">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                      Email enviado!
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Verifique sua caixa de entrada em <strong>{invite.email}</strong> e clique no link para redefinir sua senha.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setResetEmailSent(false)}
                  >
                    Voltar para login
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    Voce ja possui uma conta. Digite sua senha para aceitar o convite.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Digite sua senha"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleLogin}
                    disabled={isLoggingIn || !loginPassword}
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Entrar e Aceitar Convite
                      </>
                    )}
                  </Button>
                  <Button
                    variant="link"
                    className="w-full text-sm"
                    onClick={handleForgotPassword}
                    disabled={isResettingPassword}
                  >
                    {isResettingPassword ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Esqueci minha senha'
                    )}
                  </Button>
                </>
              )}
            </div>
          ) : (
            // Usuario novo - mostrar formulario de cadastro
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Seu nome</Label>
                <Input
                  id="name"
                  placeholder="Digite seu nome"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Crie uma senha"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Minimo 8 caracteres, com letras e numeros</p>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleSignup}
                disabled={isSigningUp || !signupName || signupPassword.length < 8 || !/[a-zA-Z]/.test(signupPassword) || !/[0-9]/.test(signupPassword)}
              >
                {isSigningUp ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Criar Conta e Aceitar Convite
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
