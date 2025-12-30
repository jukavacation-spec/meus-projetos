import { redirect } from 'next/navigation'

/**
 * Pagina raiz do dashboard - redireciona para /dashboard
 */
export default function DashboardRootPage() {
  redirect('/dashboard')
}
