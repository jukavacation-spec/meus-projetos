import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Users, Kanban, TrendingUp } from 'lucide-react'

const stats = [
  {
    title: 'Conversas Ativas',
    value: '24',
    change: '+12%',
    icon: MessageSquare,
  },
  {
    title: 'Contatos',
    value: '142',
    change: '+8%',
    icon: Users,
  },
  {
    title: 'Em Negociacao',
    value: '18',
    change: '+23%',
    icon: Kanban,
  },
  {
    title: 'Taxa de Conversao',
    value: '32%',
    change: '+4%',
    icon: TrendingUp,
  },
]

export default function DashboardPage() {
  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-green-600">{stat.change} vs mes anterior</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Conversas Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Nenhuma conversa ainda. Conecte o Chatwoot para comecar.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Atividade da Equipe</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Adicione membros a sua equipe para ver a atividade.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
