'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Bell, BellRing, Volume2, MessageSquare, AtSign, Loader2, Save } from 'lucide-react'

type NotificationSettings = {
  newMessages: boolean
  soundEnabled: boolean
  desktopEnabled: boolean
  mentions: boolean
  soundType: string
}

const SOUND_OPTIONS = [
  { value: 'default', label: 'Padrao' },
  { value: 'chime', label: 'Sino' },
  { value: 'pop', label: 'Pop' },
  { value: 'ding', label: 'Ding' },
  { value: 'none', label: 'Sem som' },
]

const STORAGE_KEY = 'notification_settings'

export function NotificationsTab() {
  const [settings, setSettings] = useState<NotificationSettings>({
    newMessages: true,
    soundEnabled: true,
    desktopEnabled: false,
    mentions: true,
    soundType: 'default',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | null>(null)

  // Carregar configuracoes do localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setSettings(JSON.parse(stored))
      } catch {
        // Ignorar erro de parse
      }
    }

    // Verificar permissao de notificacao
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission)
    }
  }, [])

  const handleChange = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      setPermissionStatus(permission)
      if (permission === 'granted') {
        handleChange('desktopEnabled', true)
      }
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSuccess(false)

    try {
      // Salvar no localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))

      // Simular delay
      await new Promise(resolve => setTimeout(resolve, 300))

      setSuccess(true)

      // Limpar mensagem de sucesso
      setTimeout(() => setSuccess(false), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-medium">Notificacoes</h3>
        <p className="text-sm text-muted-foreground">
          Configure como voce deseja receber notificacoes
        </p>
      </div>

      <div className="space-y-4">
        {/* Novas mensagens */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-start gap-3">
            <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="newMessages" className="font-medium">
                Novas mensagens
              </Label>
              <p className="text-sm text-muted-foreground">
                Receber notificacoes quando novas mensagens chegarem
              </p>
            </div>
          </div>
          <Switch
            id="newMessages"
            checked={settings.newMessages}
            onCheckedChange={(checked) => handleChange('newMessages', checked)}
          />
        </div>

        {/* Mencoes */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-start gap-3">
            <AtSign className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="mentions" className="font-medium">
                Mencoes (@)
              </Label>
              <p className="text-sm text-muted-foreground">
                Notificar quando for mencionado em mensagens
              </p>
            </div>
          </div>
          <Switch
            id="mentions"
            checked={settings.mentions}
            onCheckedChange={(checked) => handleChange('mentions', checked)}
          />
        </div>

        {/* Som de notificacao */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-start gap-3">
            <Volume2 className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="soundEnabled" className="font-medium">
                Som de notificacao
              </Label>
              <p className="text-sm text-muted-foreground">
                Reproduzir som ao receber notificacoes
              </p>
            </div>
          </div>
          <Switch
            id="soundEnabled"
            checked={settings.soundEnabled}
            onCheckedChange={(checked) => handleChange('soundEnabled', checked)}
          />
        </div>

        {/* Tipo de som */}
        {settings.soundEnabled && (
          <div className="flex items-center justify-between p-4 border rounded-lg ml-8">
            <div className="flex items-start gap-3">
              <BellRing className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <Label className="font-medium">Tipo de som</Label>
                <p className="text-sm text-muted-foreground">
                  Escolha o som de notificacao
                </p>
              </div>
            </div>
            <Select
              value={settings.soundType}
              onValueChange={(value) => handleChange('soundType', value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOUND_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Notificacoes desktop */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="desktopEnabled" className="font-medium">
                Notificacoes do navegador
              </Label>
              <p className="text-sm text-muted-foreground">
                Receber notificacoes na area de trabalho
              </p>
              {permissionStatus === 'denied' && (
                <p className="text-xs text-destructive">
                  Notificacoes bloqueadas. Habilite nas configuracoes do navegador.
                </p>
              )}
            </div>
          </div>
          {permissionStatus === 'granted' ? (
            <Switch
              id="desktopEnabled"
              checked={settings.desktopEnabled}
              onCheckedChange={(checked) => handleChange('desktopEnabled', checked)}
            />
          ) : permissionStatus === 'denied' ? (
            <Switch disabled checked={false} />
          ) : (
            <Button variant="outline" size="sm" onClick={requestNotificationPermission}>
              Permitir
            </Button>
          )}
        </div>
      </div>

      {/* Sucesso */}
      {success && (
        <div className="bg-green-500/10 text-green-600 text-sm p-3 rounded-md">
          Configuracoes salvas com sucesso!
        </div>
      )}

      {/* Botao de salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
