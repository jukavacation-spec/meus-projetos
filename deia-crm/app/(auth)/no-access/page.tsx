'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldX, LogOut, Mail } from 'lucide-react'

export default function NoAccessPage() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <CardTitle className="text-2xl">Acesso Negado</CardTitle>
        <CardDescription>
          Sua conta nao esta vinculada a nenhuma empresa
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center text-sm text-muted-foreground space-y-4">
        <p>
          Para acessar o FalDesk, voce precisa ser convidado por uma empresa
          ou adquirir uma licenca.
        </p>
        <div className="flex items-center justify-center gap-2 p-4 bg-muted rounded-lg">
          <Mail className="h-5 w-5 text-primary" />
          <span>Verifique seu email por um convite</span>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button variant="outline" className="w-full" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Sair e usar outra conta
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Precisa de ajuda?{' '}
          <a href="mailto:suporte@faltechia.com" className="text-primary hover:underline">
            Entre em contato
          </a>
        </p>
      </CardFooter>
    </Card>
  )
}
