import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Pagina raiz - redireciona para o dashboard ou login
 */
export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Redirecionar para o dashboard (que tem AuthProvider)
  redirect('/dashboard')
}
