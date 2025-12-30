'use client'

import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { CompanySettings } from '@/components/settings/CompanySettings'
import { TeamSettings } from '@/components/settings/TeamSettings'
import { NotificationSettings } from '@/components/settings/NotificationSettings'
import { KanbanStagesSettings } from '@/components/settings/KanbanStagesSettings'
import { UnifiedInboxSettings } from '@/components/settings/UnifiedInboxSettings'
import { useAuth } from '@/hooks/useAuth'
import {
  MessageCircle,
  Building2,
  Users,
  Bell,
  Layers,
  ShieldAlert,
} from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const { hasPermission, isLoading } = useAuth()

  // Verificar permissao de acesso às configuracoes
  const canAccessSettings = hasPermission('settings', 'read')

  // Se ainda está carregando, mostra loading
  if (isLoading) {
    return (
      <>
        <Header title="Configuracoes" />
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </>
    )
  }

  // Se não tem permissão, mostra mensagem de acesso negado
  if (!canAccessSettings) {
    return (
      <>
        <Header title="Acesso Negado" />
        <div className="p-6 flex flex-col items-center justify-center min-h-[400px] text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground max-w-md">
            Você não tem permissão para acessar as configurações.
            Entre em contato com o administrador da sua empresa.
          </p>
          <Button className="mt-6" onClick={() => router.push('/')}>
            Voltar ao Início
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Configuracoes" />
      <div className="p-6">
        <Tabs defaultValue="kanban" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="company" className="gap-2">
              <Building2 className="h-4 w-4" />
              Empresa
            </TabsTrigger>
            <TabsTrigger value="kanban" className="gap-2">
              <Layers className="h-4 w-4" />
              Status
            </TabsTrigger>
            <TabsTrigger value="inboxes" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Inboxes
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              Equipe
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notificacoes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <CompanySettings />
          </TabsContent>

          <TabsContent value="kanban">
            <KanbanStagesSettings />
          </TabsContent>

          <TabsContent value="inboxes">
            <UnifiedInboxSettings />
          </TabsContent>

          <TabsContent value="team">
            <TeamSettings />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationSettings />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
