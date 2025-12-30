'use client'

import { useState, useEffect, useMemo } from 'react'
import { useInboxes, getChannelName } from '@/hooks/useInboxes'
import { useInstances, useInstanceStatusPolling, type Instance, type InstanceStatus } from '@/hooks/useInstances'
import { useAuth } from '@/hooks/useAuth'
import { getPlanLimits, getMaxInstances, canPurchaseAdditional, getRemainingAdditionalSlots } from '@/lib/plans'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  Plus,
  Smartphone,
  Wifi,
  WifiOff,
  Loader2,
  Trash2,
  RefreshCw,
  QrCode,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  MessageCircle,
  Mail,
  Globe,
  Send,
  Facebook,
  Twitter,
  Code,
  Users,
  Shield,
  ArrowUpCircle,
  AlertTriangle,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { useInstanceAccess } from '@/hooks/useInstanceAccess'
import { cn } from '@/lib/utils'

// Tipo unificado para exibição
type UnifiedInbox = {
  id: number // ID da inbox do Chatwoot
  name: string
  type: 'whatsapp' | 'email' | 'web' | 'telegram' | 'sms' | 'facebook' | 'twitter' | 'api' | 'other'
  channelType: string
  phoneNumber?: string | null
  // UAZAPI instance (se for WhatsApp e tiver vinculado)
  instance?: Instance
  uazapiStatus?: InstanceStatus
  whatsappNumber?: string | null
  whatsappProfileName?: string | null
  whatsappProfilePic?: string | null
  // Settings
  isActive?: boolean
}

function ChannelIcon({ channelType, className }: { channelType?: string; className?: string }) {
  const iconClass = cn("h-5 w-5", className)

  switch (channelType) {
    case 'Channel::Whatsapp':
    case 'whatsapp':
      return <MessageCircle className={cn(iconClass, "text-green-500")} />
    case 'Channel::Email':
    case 'email':
      return <Mail className={cn(iconClass, "text-blue-500")} />
    case 'Channel::WebWidget':
    case 'web':
      return <Globe className={cn(iconClass, "text-purple-500")} />
    case 'Channel::Telegram':
    case 'telegram':
      return <Send className={cn(iconClass, "text-sky-500")} />
    case 'Channel::TwilioSms':
    case 'Channel::Sms':
    case 'sms':
      return <Smartphone className={cn(iconClass, "text-orange-500")} />
    case 'Channel::FacebookPage':
    case 'facebook':
      return <Facebook className={cn(iconClass, "text-blue-600")} />
    case 'Channel::TwitterProfile':
    case 'twitter':
      return <Twitter className={cn(iconClass, "text-sky-400")} />
    case 'Channel::Api':
    case 'api':
      return <Code className={cn(iconClass, "text-gray-500")} />
    default:
      return <MessageCircle className={cn(iconClass, "text-gray-400")} />
  }
}

// Normalizar número de telefone para comparação
function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return ''
  // Remove tudo exceto números
  return phone.replace(/\D/g, '')
}

export function UnifiedInboxSettings() {
  const { company } = useAuth()
  // Nas configurações, admin precisa ver TODAS as inboxes (sem filtro de agente)
  const { inboxes, isLoading: inboxesLoading, refetch: refetchInboxes } = useInboxes({ filterByAgent: false })
  const {
    instances,
    isLoading: instancesLoading,
    isCreating,
    error: instancesError,
    createInstance,
    deleteInstance,
    reconnectInstance,
    refetch: refetchInstances,
  } = useInstances()

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newInstanceName, setNewInstanceName] = useState('')
  const [createdInstanceId, setCreatedInstanceId] = useState<string | null>(null)
  const [reconnectingInboxId, setReconnectingInboxId] = useState<number | null>(null)
  const [accessDialogInstance, setAccessDialogInstance] = useState<Instance | null>(null)
  const [inboxSettings, setInboxSettings] = useState<Record<number, boolean>>({})
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingInbox, setSavingInbox] = useState<number | null>(null)

  // Carregar configurações de inbox
  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch('/api/settings/inboxes')
        if (response.ok) {
          const data = await response.json()
          setInboxSettings(data.settings || {})
        }
      } catch {
      } finally {
        setLoadingSettings(false)
      }
    }
    loadSettings()
  }, [])

  // Calcular limites do plano
  const planLimits = getPlanLimits(company?.plan)
  const additionalPurchased = (company as { additional_instances?: number })?.additional_instances || 0
  const currentWhatsAppCount = instances.length
  const maxInstances = getMaxInstances(company?.plan, additionalPurchased)
  const canCreateWhatsApp = currentWhatsAppCount < maxInstances
  const canBuyMore = canPurchaseAdditional(company?.plan, additionalPurchased)
  const remainingSlots = getRemainingAdditionalSlots(company?.plan, additionalPurchased)

  // Criar mapa de instâncias por chatwoot_inbox_id
  const instancesByInboxId = useMemo(() => {
    const map = new Map<number, Instance>()
    instances.forEach(instance => {
      if (instance.chatwoot_inbox_id) {
        map.set(instance.chatwoot_inbox_id, instance)
      }
    })
    return map
  }, [instances])

  // Criar conjunto de números já em uso (normalizados)
  const usedPhoneNumbers = useMemo(() => {
    const numbers = new Set<string>()
    instances.forEach(instance => {
      const normalized = normalizePhoneNumber(instance.whatsapp_number)
      if (normalized) {
        numbers.add(normalized)
      }
    })
    return numbers
  }, [instances])

  // Unificar inboxes com dados do UAZAPI
  const unifiedInboxes: UnifiedInbox[] = useMemo(() => {
    return inboxes.map((inbox) => {
      const instance = instancesByInboxId.get(inbox.id)
      // Se tem instância UAZAPI vinculada, é WhatsApp (mesmo que channel_type seja 'Channel::Api')
      const hasUazapiInstance = !!instance
      const type = hasUazapiInstance ? 'whatsapp' : getInboxType(inbox.channel_type)

      return {
        id: inbox.id,
        name: inbox.name,
        type,
        channelType: hasUazapiInstance ? 'Channel::Whatsapp' : inbox.channel_type,
        phoneNumber: inbox.phone_number,
        // Dados do UAZAPI (se tiver instância vinculada)
        instance,
        uazapiStatus: instance?.uazapi_status,
        whatsappNumber: instance?.whatsapp_number || inbox.phone_number,
        whatsappProfileName: instance?.whatsapp_profile_name,
        whatsappProfilePic: instance?.whatsapp_profile_pic_url,
        // Settings
        isActive: inboxSettings[inbox.id] !== false,
      }
    })
  }, [inboxes, instancesByInboxId, inboxSettings])

  // Contar WhatsApp conectados
  const connectedWhatsAppCount = unifiedInboxes.filter(
    inbox => inbox.type === 'whatsapp' && inbox.uazapiStatus === 'connected'
  ).length

  const isLoading = inboxesLoading || instancesLoading || loadingSettings

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) {
      toast.error('Digite um nome para a conexao')
      return
    }

    const result = await createInstance(newInstanceName.trim())

    if (result.success && result.instance) {
      setCreatedInstanceId(result.instance.id)
      setNewInstanceName('')
      toast.success('Conexao criada - Escaneie o QR Code para conectar')
    } else {
      toast.error(result.error || 'Erro ao criar conexao')
    }
  }

  const handleDeleteInstance = async (instance: Instance) => {
    const result = await deleteInstance(instance.id)

    if (result.success) {
      toast.success(`${instance.name} foi removida com sucesso`)
    } else {
      toast.error(result.error || 'Erro ao remover conexao')
    }
  }

  const handleReconnect = async (inbox: UnifiedInbox) => {
    if (!inbox.instance) {
      toast.error('Instância não encontrada')
      return
    }

    const result = await reconnectInstance(inbox.instance.id)

    if (result.success) {
      setCreatedInstanceId(inbox.instance.id)
      setReconnectingInboxId(inbox.id)
      setIsCreateDialogOpen(true)
      toast.info('Escaneie o QR Code para reconectar')
    } else {
      toast.error(result.error || 'Erro ao reconectar')
    }
  }

  const handleDialogClose = () => {
    setIsCreateDialogOpen(false)
    setCreatedInstanceId(null)
    setReconnectingInboxId(null)
    setNewInstanceName('')
    refetchInstances()
    refetchInboxes()
  }

  const isInboxActive = (inboxId: number): boolean => {
    if (!(inboxId in inboxSettings)) return true
    return inboxSettings[inboxId]
  }

  const toggleInbox = async (inboxId: number) => {
    const currentActive = isInboxActive(inboxId)
    const newValue = !currentActive
    setSavingInbox(inboxId)

    try {
      const response = await fetch('/api/settings/inboxes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inboxId, isActive: newValue })
      })

      if (response.ok) {
        setInboxSettings(prev => ({ ...prev, [inboxId]: newValue }))
      }
    } catch {
    } finally {
      setSavingInbox(null)
    }
  }

  const handleRefresh = () => {
    refetchInstances()
    refetchInboxes()
  }

  // Validar número duplicado
  const checkDuplicateNumber = (phoneNumber: string): boolean => {
    const normalized = normalizePhoneNumber(phoneNumber)
    return usedPhoneNumbers.has(normalized)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Inboxes
              </CardTitle>
              <CardDescription className="flex items-center gap-2 flex-wrap mt-1">
                <span>{unifiedInboxes.length} canal(is) configurado(s)</span>
                {connectedWhatsAppCount > 0 && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <Wifi className="h-3 w-3 mr-1" />
                    {connectedWhatsAppCount} WhatsApp conectado(s)
                  </Badge>
                )}
                {!canCreateWhatsApp && canBuyMore && (
                  <Badge variant="outline" className="text-orange-600 border-orange-600">
                    +{remainingSlots} WhatsApp disponivel por R${planLimits.additionalInstancePrice}
                  </Badge>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                title="Atualizar"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              {!canCreateWhatsApp && canBuyMore && (
                <Button variant="outline" size="sm" className="text-orange-600 border-orange-600 hover:bg-orange-50">
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Upgrade
                </Button>
              )}
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      setCreatedInstanceId(null)
                      setReconnectingInboxId(null)
                    }}
                    disabled={!canCreateWhatsApp}
                    title={!canCreateWhatsApp ? 'Limite de WhatsApp atingido' : undefined}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar WhatsApp
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <CreateInstanceDialog
                    instanceName={newInstanceName}
                    setInstanceName={setNewInstanceName}
                    isCreating={isCreating}
                    createdInstanceId={createdInstanceId}
                    reconnectingInboxId={reconnectingInboxId}
                    onCreate={handleCreateInstance}
                    onClose={handleDialogClose}
                    checkDuplicateNumber={checkDuplicateNumber}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {instancesError && (
            <div className="mb-4 p-3 rounded-md bg-destructive/15 text-sm text-destructive">
              {instancesError}
            </div>
          )}

          {unifiedInboxes.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Nenhum canal configurado
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Clique em &quot;Adicionar WhatsApp&quot; para conectar seu primeiro numero
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {unifiedInboxes.map((inbox) => (
                <InboxCard
                  key={inbox.id}
                  inbox={inbox}
                  isActive={isInboxActive(inbox.id)}
                  isSaving={savingInbox === inbox.id}
                  onToggle={() => toggleInbox(inbox.id)}
                  onDelete={inbox.instance ? () => handleDeleteInstance(inbox.instance!) : undefined}
                  onReconnect={inbox.instance && inbox.uazapiStatus !== 'connected' ? () => handleReconnect(inbox) : undefined}
                  onManageAccess={inbox.instance ? () => setAccessDialogInstance(inbox.instance!) : undefined}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Access Management Dialog */}
      <Dialog
        open={!!accessDialogInstance}
        onOpenChange={(open) => !open && setAccessDialogInstance(null)}
      >
        <DialogContent className="sm:max-w-lg">
          {accessDialogInstance && (
            <AccessManagementDialog
              instance={accessDialogInstance}
              onClose={() => setAccessDialogInstance(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Inbox Card Component
function InboxCard({
  inbox,
  isActive,
  isSaving,
  onToggle,
  onDelete,
  onReconnect,
  onManageAccess,
}: {
  inbox: UnifiedInbox
  isActive: boolean
  isSaving: boolean
  onToggle?: () => void
  onDelete?: () => void
  onReconnect?: () => void
  onManageAccess?: () => void
}) {
  const isWhatsApp = inbox.type === 'whatsapp'
  const hasInstance = !!inbox.instance
  const statusConfig = isWhatsApp ? getStatusConfig(inbox.uazapiStatus, hasInstance) : null

  // Número a exibir (prioriza o do UAZAPI se disponível)
  const displayNumber = inbox.whatsappNumber || inbox.phoneNumber

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-4">
        {/* Avatar / Icon */}
        {isWhatsApp && inbox.uazapiStatus === 'connected' && inbox.whatsappProfilePic ? (
          <Avatar className="h-12 w-12">
            <AvatarImage src={inbox.whatsappProfilePic} />
            <AvatarFallback>
              {inbox.whatsappProfileName?.charAt(0) || 'W'}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className={cn(
            "h-12 w-12 rounded-full flex items-center justify-center",
            statusConfig?.bgColor || "bg-muted"
          )}>
            <ChannelIcon channelType={inbox.channelType} className={statusConfig?.iconColor} />
          </div>
        )}

        {/* Info */}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{inbox.name}</p>
            <Badge variant="secondary" className="text-xs">
              {isWhatsApp ? 'WhatsApp' : getChannelName(inbox.channelType || '')}
            </Badge>
            {statusConfig && (
              <Badge variant={statusConfig.variant as 'default' | 'secondary' | 'destructive' | 'outline'}>
                {statusConfig.icon}
                <span className="ml-1">{statusConfig.label}</span>
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            {displayNumber && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {displayNumber}
              </span>
            )}
            {inbox.whatsappProfileName && (
              <span>{inbox.whatsappProfileName}</span>
            )}
            {isWhatsApp && !hasInstance && (
              <span className="flex items-center gap-1 text-orange-600">
                <AlertTriangle className="h-3 w-3" />
                Sem conexão UAZAPI
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* WhatsApp specific actions */}
        {isWhatsApp && (
          <>
            {hasInstance && onManageAccess && (
              <Button
                variant="outline"
                size="sm"
                onClick={onManageAccess}
                title="Gerenciar acesso"
              >
                <Users className="h-4 w-4 mr-2" />
                Acesso
              </Button>
            )}

            {hasInstance && inbox.uazapiStatus !== 'connected' && onReconnect && (
              <Button variant="outline" size="sm" onClick={onReconnect}>
                {inbox.uazapiStatus === 'qr_ready' ? (
                  <>
                    <QrCode className="h-4 w-4 mr-2" />
                    Escanear QR
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {inbox.uazapiStatus === 'disconnected' ? 'Reconectar' : 'Conectar'}
                  </>
                )}
              </Button>
            )}

            {hasInstance && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover conexao?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja remover &quot;{inbox.name}&quot;?
                      Esta acao nao pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}

        {/* Toggle ativo/inativo - para todas as inboxes */}
        {onToggle && (
          <div className="flex items-center gap-2 ml-2 pl-2 border-l">
            <Label className="text-sm text-muted-foreground">
              {isSaving ? 'Salvando...' : isActive ? 'Ativo' : 'Inativo'}
            </Label>
            <Switch
              checked={isActive}
              onCheckedChange={onToggle}
              disabled={isSaving}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Create Instance Dialog Content
function CreateInstanceDialog({
  instanceName,
  setInstanceName,
  isCreating,
  createdInstanceId,
  reconnectingInboxId,
  onCreate,
  onClose,
  checkDuplicateNumber,
}: {
  instanceName: string
  setInstanceName: (name: string) => void
  isCreating: boolean
  createdInstanceId: string | null
  reconnectingInboxId: number | null
  onCreate: () => void
  onClose: () => void
  checkDuplicateNumber: (phone: string) => boolean
}) {
  const { status, qrCode, instance } = useInstanceStatusPolling(
    createdInstanceId,
    !!createdInstanceId
  )
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'connected' && instance?.whatsapp_number) {
      // Verificar se número já existe (exceto em reconexão)
      if (!reconnectingInboxId && checkDuplicateNumber(instance.whatsapp_number)) {
        setDuplicateWarning(`O número ${instance.whatsapp_number} já está em uso em outra inbox.`)
      }
    }
  }, [status, instance, reconnectingInboxId, checkDuplicateNumber])

  useEffect(() => {
    if (status === 'connected' && !duplicateWarning) {
      setTimeout(() => {
        onClose()
      }, 2000)
    }
  }, [status, duplicateWarning, onClose])

  if (!createdInstanceId) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Adicionar WhatsApp</DialogTitle>
          <DialogDescription>
            Escolha um nome para identificar esta conexao
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="instanceName">Nome da conexao</Label>
            <Input
              id="instanceName"
              placeholder="Ex: Comercial, Suporte, Vendas..."
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              disabled={isCreating}
            />
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Importante
            </p>
            <p className="text-muted-foreground mt-1">
              Cada número de telefone só pode ser conectado a uma inbox.
              Se o número já estiver em uso, a conexão será recusada.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancelar
          </Button>
          <Button onClick={onCreate} disabled={isCreating || !instanceName.trim()}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar Conexao'
            )}
          </Button>
        </DialogFooter>
      </>
    )
  }

  if (status === 'connected') {
    if (duplicateWarning) {
      return (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Número Duplicado
            </DialogTitle>
          </DialogHeader>
          <div className="py-8">
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="font-medium text-lg mb-2">Conexão Recusada</h3>
              <p className="text-muted-foreground">{duplicateWarning}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Desconecte o número da outra inbox primeiro ou use um número diferente.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={onClose}>
              Entendi
            </Button>
          </DialogFooter>
        </>
      )
    }

    return (
      <>
        <DialogHeader>
          <DialogTitle>Conectado com sucesso!</DialogTitle>
        </DialogHeader>
        <div className="py-8">
          <div className="text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-medium text-lg mb-1">WhatsApp conectado</h3>
            {instance?.whatsapp_number && (
              <p className="text-muted-foreground">{instance.whatsapp_number}</p>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Escaneie o QR Code
        </DialogTitle>
        <DialogDescription>
          Abra o WhatsApp no seu celular e escaneie o codigo
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <div className="bg-white p-4 rounded-lg flex items-center justify-center min-h-[280px]">
          {qrCode ? (
            <img
              src={qrCode}
              alt="QR Code"
              className="max-w-full max-h-[260px]"
            />
          ) : (
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
            </div>
          )}
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            {status === 'connecting' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Conectando...
              </span>
            ) : (
              'Aguardando conexao...'
            )}
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      </DialogFooter>
    </>
  )
}

// Access Management Dialog
function AccessManagementDialog({
  instance,
  onClose,
}: {
  instance: Instance
  onClose: () => void
}) {
  const {
    loading,
    error,
    fetchAccess,
    toggleAccess,
    members,
    canManage,
  } = useInstanceAccess(instance.id)

  const [togglingUser, setTogglingUser] = useState<string | null>(null)

  useEffect(() => {
    fetchAccess()
  }, [fetchAccess])

  const handleToggle = async (userId: string, hasAccess: boolean) => {
    setTogglingUser(userId)
    const success = await toggleAccess(userId, hasAccess)
    setTogglingUser(null)

    if (success) {
      toast.success(hasAccess ? 'Acesso removido' : 'Acesso concedido')
    } else {
      toast.error('Erro ao alterar acesso')
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Gerenciar Acesso
        </DialogTitle>
        <DialogDescription>
          Controle quais membros podem acessar &quot;{instance.name}&quot;
        </DialogDescription>
      </DialogHeader>

      <div className="py-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchAccess} className="mt-2">
              Tentar novamente
            </Button>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum membro encontrado</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {member.avatar_url && <AvatarImage src={member.avatar_url} />}
                    <AvatarFallback>
                      {member.name?.charAt(0)?.toUpperCase() || member.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {member.name || member.email.split('@')[0]}
                      </span>
                      {member.isAdminOrOwner && (
                        <Badge variant="secondary" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          {(member.role as { display_name?: string })?.display_name || 'Admin'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {member.isAdminOrOwner ? (
                    <span className="text-xs text-muted-foreground">
                      Sempre tem acesso
                    </span>
                  ) : togglingUser === member.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Checkbox
                      checked={member.hasAccess}
                      onCheckedChange={() => handleToggle(member.id, member.hasAccess)}
                      disabled={!canManage || member.isAdminOrOwner}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!canManage && !loading && (
        <p className="text-xs text-muted-foreground text-center mb-4">
          Somente administradores podem alterar os acessos
        </p>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </DialogFooter>
    </>
  )
}

// Helper functions
function getInboxType(channelType?: string): UnifiedInbox['type'] {
  switch (channelType) {
    case 'Channel::Whatsapp':
      return 'whatsapp'
    case 'Channel::Email':
      return 'email'
    case 'Channel::WebWidget':
      return 'web'
    case 'Channel::Telegram':
      return 'telegram'
    case 'Channel::TwilioSms':
    case 'Channel::Sms':
      return 'sms'
    case 'Channel::FacebookPage':
      return 'facebook'
    case 'Channel::TwitterProfile':
      return 'twitter'
    case 'Channel::Api':
      return 'api'
    default:
      return 'other'
  }
}

function getStatusConfig(status: InstanceStatus | undefined, hasInstance: boolean) {
  if (!hasInstance) {
    return {
      label: 'Não configurado',
      variant: 'outline',
      bgColor: 'bg-gray-100 dark:bg-gray-800',
      iconColor: 'text-gray-500',
      icon: <AlertTriangle className="h-3 w-3" />,
    }
  }

  switch (status) {
    case 'connected':
      return {
        label: 'Conectado',
        variant: 'default',
        bgColor: 'bg-green-100 dark:bg-green-900',
        iconColor: 'text-green-600 dark:text-green-400',
        icon: <Wifi className="h-3 w-3" />,
      }
    case 'disconnected':
      return {
        label: 'Desconectado',
        variant: 'secondary',
        bgColor: 'bg-orange-100 dark:bg-orange-900',
        iconColor: 'text-orange-600 dark:text-orange-400',
        icon: <WifiOff className="h-3 w-3" />,
      }
    case 'qr_ready':
      return {
        label: 'QR Pronto',
        variant: 'outline',
        bgColor: 'bg-blue-100 dark:bg-blue-900',
        iconColor: 'text-blue-600 dark:text-blue-400',
        icon: <QrCode className="h-3 w-3" />,
      }
    case 'connecting':
      return {
        label: 'Conectando',
        variant: 'outline',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900',
        iconColor: 'text-yellow-600 dark:text-yellow-400',
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
      }
    case 'error':
      return {
        label: 'Erro',
        variant: 'destructive',
        bgColor: 'bg-red-100 dark:bg-red-900',
        iconColor: 'text-red-600 dark:text-red-400',
        icon: <XCircle className="h-3 w-3" />,
      }
    default:
      return {
        label: 'Aguardando',
        variant: 'secondary',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        iconColor: 'text-gray-600 dark:text-gray-400',
        icon: <Clock className="h-3 w-3" />,
      }
  }
}
