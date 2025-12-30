'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useNotificationPreferences } from '@/hooks/useNotifications'
import {
  Bell,
  Mail,
  Volume2,
  MessageCircle,
  MessageSquare,
  UserCheck,
  AtSign,
  CheckCircle,
  UserPlus,
  Moon,
} from 'lucide-react'

export function NotificationSettings() {
  const { preferences, isLoading, isSaving, updatePreferences } = useNotificationPreferences()
  // Usar useRef para rastrear alterações otimistas pendentes
  const pendingChangesRef = useRef<Record<string, unknown>>({})
  const [optimisticPrefs, setOptimisticPrefs] = useState<Record<string, unknown>>({})

  // Combinar preferences com alterações otimistas
  const localPrefs = preferences ? { ...preferences, ...optimisticPrefs } : null

  const handleToggle = async (key: string, value: boolean) => {
    if (!preferences) return

    // Atualização otimista
    setOptimisticPrefs(prev => ({ ...prev, [key]: value }))
    pendingChangesRef.current[key] = value

    try {
      await updatePreferences({ [key]: value })
      // Limpar do pendingChanges após sucesso
      delete pendingChangesRef.current[key]
    } catch {
      // Revert on error
      setOptimisticPrefs(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      // Error handled silently
    }
  }

  const handleTimeChange = async (key: 'quiet_hours_start' | 'quiet_hours_end', value: string) => {
    if (!preferences) return

    // Atualização otimista
    setOptimisticPrefs(prev => ({ ...prev, [key]: value }))

    try {
      await updatePreferences({ [key]: value })
    } catch {
      // Revert on error
      setOptimisticPrefs(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      // Error handled silently
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!localPrefs) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Erro ao carregar preferencias de notificacao.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Canais de Notificacao */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Canais de Notificacao
          </CardTitle>
          <CardDescription>
            Escolha como deseja receber notificacoes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Notificacoes por email</p>
                <p className="text-sm text-muted-foreground">
                  Receber alertas por email
                </p>
              </div>
            </div>
            <Switch
              checked={localPrefs.email_enabled}
              onCheckedChange={(checked) => handleToggle('email_enabled', checked)}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Notificacoes push</p>
                <p className="text-sm text-muted-foreground">
                  Receber notificacoes no navegador
                </p>
              </div>
            </div>
            <Switch
              checked={localPrefs.push_enabled}
              onCheckedChange={(checked) => handleToggle('push_enabled', checked)}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Som de notificacao</p>
                <p className="text-sm text-muted-foreground">
                  Tocar som ao receber mensagem
                </p>
              </div>
            </div>
            <Switch
              checked={localPrefs.sound_enabled}
              onCheckedChange={(checked) => handleToggle('sound_enabled', checked)}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tipos de Notificacao */}
      <Card>
        <CardHeader>
          <CardTitle>Tipos de Notificacao</CardTitle>
          <CardDescription>
            Selecione quais eventos devem gerar notificacoes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium">Novas conversas</p>
                <p className="text-sm text-muted-foreground">
                  Quando uma nova conversa e iniciada
                </p>
              </div>
            </div>
            <Switch
              checked={localPrefs.notify_new_conversation}
              onCheckedChange={(checked) => handleToggle('notify_new_conversation', checked)}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">Novas mensagens</p>
                <p className="text-sm text-muted-foreground">
                  Quando receber uma nova mensagem
                </p>
              </div>
            </div>
            <Switch
              checked={localPrefs.notify_new_message}
              onCheckedChange={(checked) => handleToggle('notify_new_message', checked)}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-purple-500" />
              <div>
                <p className="font-medium">Atribuicoes</p>
                <p className="text-sm text-muted-foreground">
                  Quando uma conversa for atribuida a voce
                </p>
              </div>
            </div>
            <Switch
              checked={localPrefs.notify_assigned}
              onCheckedChange={(checked) => handleToggle('notify_assigned', checked)}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AtSign className="h-5 w-5 text-orange-500" />
              <div>
                <p className="font-medium">Mencoes</p>
                <p className="text-sm text-muted-foreground">
                  Quando voce for mencionado
                </p>
              </div>
            </div>
            <Switch
              checked={localPrefs.notify_mention}
              onCheckedChange={(checked) => handleToggle('notify_mention', checked)}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="font-medium">Conversas resolvidas</p>
                <p className="text-sm text-muted-foreground">
                  Quando uma conversa for marcada como resolvida
                </p>
              </div>
            </div>
            <Switch
              checked={localPrefs.notify_resolved}
              onCheckedChange={(checked) => handleToggle('notify_resolved', checked)}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-indigo-500" />
              <div>
                <p className="font-medium">Convites de equipe</p>
                <p className="text-sm text-muted-foreground">
                  Quando receber um convite para a equipe
                </p>
              </div>
            </div>
            <Switch
              checked={localPrefs.notify_team_invite}
              onCheckedChange={(checked) => handleToggle('notify_team_invite', checked)}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Horario Silencioso */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Horario Silencioso
          </CardTitle>
          <CardDescription>
            Desative notificacoes durante determinados horarios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Ativar horario silencioso</p>
              <p className="text-sm text-muted-foreground">
                Pausar notificacoes durante o periodo definido
              </p>
            </div>
            <Switch
              checked={localPrefs.quiet_hours_enabled}
              onCheckedChange={(checked) => handleToggle('quiet_hours_enabled', checked)}
              disabled={isSaving}
            />
          </div>

          {localPrefs.quiet_hours_enabled && (
            <div className="flex items-center gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="quiet-start">Inicio</Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={localPrefs.quiet_hours_start}
                  onChange={(e) => handleTimeChange('quiet_hours_start', e.target.value)}
                  className="w-32"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiet-end">Fim</Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={localPrefs.quiet_hours_end}
                  onChange={(e) => handleTimeChange('quiet_hours_end', e.target.value)}
                  className="w-32"
                  disabled={isSaving}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
