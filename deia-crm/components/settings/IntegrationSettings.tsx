'use client'

import { useState, useEffect } from 'react'
import { useInstances, useInstanceStatusPolling, type Instance, type InstanceStatus } from '@/hooks/useInstances'
import { useAuth } from '@/hooks/useAuth'
import { getPlanLimits, getMaxInstances, canPurchaseAdditional, getRemainingAdditionalSlots } from '@/lib/plans'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  MessageSquare,
  ArrowUpCircle,
  Users,
  Shield,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { useInstanceAccess } from '@/hooks/useInstanceAccess'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function IntegrationSettings() {
  const { company } = useAuth()
  const {
    instances,
    isLoading,
    isCreating,
    error,
    createInstance,
    deleteInstance,
    reconnectInstance,
    refetch,
  } = useInstances()

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newInstanceName, setNewInstanceName] = useState('')
  const [createdInstanceId, setCreatedInstanceId] = useState<string | null>(null)
  const [accessDialogInstance, setAccessDialogInstance] = useState<Instance | null>(null)

  // Calcular limites do plano (base + adicionais compradas)
  const planLimits = getPlanLimits(company?.plan)
  const additionalPurchased = (company as { additional_instances?: number })?.additional_instances || 0
  const currentCount = instances.length
  const maxInstances = getMaxInstances(company?.plan, additionalPurchased)
  const canCreate = currentCount < maxInstances
  const canBuyMore = canPurchaseAdditional(company?.plan, additionalPurchased)
  const remainingSlots = getRemainingAdditionalSlots(company?.plan, additionalPurchased)

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

  const handleDelete = async (instance: Instance) => {
    const result = await deleteInstance(instance.id)

    if (result.success) {
      toast.success(`${instance.name} foi removida com sucesso`)
    } else {
      toast.error(result.error || 'Erro ao remover conexao')
    }
  }

  const handleReconnect = async (instance: Instance) => {
    const result = await reconnectInstance(instance.id)

    if (result.success) {
      setCreatedInstanceId(instance.id)
      setIsCreateDialogOpen(true)
      toast.info('Escaneie o QR Code para reconectar')
    } else {
      toast.error(result.error || 'Erro ao reconectar')
    }
  }

  const handleDialogClose = () => {
    setIsCreateDialogOpen(false)
    setCreatedInstanceId(null)
    setNewInstanceName('')
    refetch()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Integracoes WhatsApp
              </CardTitle>
              <CardDescription className="flex items-center gap-2 flex-wrap">
                <span>
                  {currentCount} de {maxInstances} conexao(oes) utilizadas
                </span>
                {!canCreate && canBuyMore && (
                  <Badge variant="outline" className="text-orange-600 border-orange-600">
                    +{remainingSlots} adicional(is) disponivel(is) por R${planLimits.additionalInstancePrice}
                  </Badge>
                )}
                {!canCreate && !canBuyMore && (
                  <Badge variant="secondary">
                    Limite atingido
                  </Badge>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                disabled={isLoading}
                title="Atualizar status"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              {!canCreate && (
                <Button variant="outline" size="sm" className="text-orange-600 border-orange-600 hover:bg-orange-50">
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Fazer Upgrade
                </Button>
              )}
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => setCreatedInstanceId(null)}
                    disabled={!canCreate}
                    title={!canCreate ? 'Limite de conexoes atingido' : undefined}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Conexao
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <CreateInstanceDialog
                    instanceName={newInstanceName}
                    setInstanceName={setNewInstanceName}
                    isCreating={isCreating}
                    createdInstanceId={createdInstanceId}
                    onCreate={handleCreateInstance}
                    onClose={handleDialogClose}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Error message */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Instances list */}
      {instances.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Smartphone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Nenhuma conexao configurada
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Clique em &quot;Nova Conexao&quot; para conectar seu primeiro WhatsApp
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {instances.map((instance) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              onDelete={handleDelete}
              onReconnect={handleReconnect}
              onManageAccess={setAccessDialogInstance}
            />
          ))}
        </div>
      )}

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

// Instance Card Component
function InstanceCard({
  instance,
  onDelete,
  onReconnect,
  onManageAccess,
}: {
  instance: Instance
  onDelete: (instance: Instance) => void
  onReconnect: (instance: Instance) => void
  onManageAccess: (instance: Instance) => void
}) {
  const statusConfig = getStatusConfig(instance.uazapi_status)

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar / Icon */}
            {instance.uazapi_status === 'connected' && instance.whatsapp_profile_pic_url ? (
              <Avatar className="h-12 w-12">
                <AvatarImage src={instance.whatsapp_profile_pic_url} />
                <AvatarFallback>
                  {instance.whatsapp_profile_name?.charAt(0) || 'W'}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${statusConfig.bgColor}`}>
                <Smartphone className={`h-6 w-6 ${statusConfig.iconColor}`} />
              </div>
            )}

            {/* Info */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{instance.name}</h3>
                <Badge variant={statusConfig.variant as 'default' | 'secondary' | 'destructive' | 'outline'}>
                  {statusConfig.icon}
                  <span className="ml-1">{statusConfig.label}</span>
                </Badge>
              </div>

              {instance.uazapi_status === 'connected' ? (
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  {instance.whatsapp_number && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {instance.whatsapp_number}
                    </span>
                  )}
                  {instance.whatsapp_profile_name && (
                    <span>{instance.whatsapp_profile_name}</span>
                  )}
                  {instance.chatwoot_inbox_id && (
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Inbox #{instance.chatwoot_inbox_id}
                    </span>
                  )}
                </div>
              ) : instance.uazapi_status === 'disconnected' && instance.disconnected_at ? (
                <p className="text-sm text-muted-foreground mt-1">
                  Desconectado {formatDistanceToNow(new Date(instance.disconnected_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Criado {formatDistanceToNow(new Date(instance.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onManageAccess(instance)}
              title="Gerenciar quem pode acessar esta conexao"
            >
              <Users className="h-4 w-4 mr-2" />
              Acesso
            </Button>

            {instance.uazapi_status !== 'connected' && (
              <Button variant="outline" size="sm" onClick={() => onReconnect(instance)}>
                {instance.uazapi_status === 'qr_ready' ? (
                  <>
                    <QrCode className="h-4 w-4 mr-2" />
                    Escanear QR
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {instance.uazapi_status === 'disconnected' ? 'Reconectar' : 'Conectar'}
                  </>
                )}
              </Button>
            )}

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
                    Tem certeza que deseja remover a conexao &quot;{instance.name}&quot;?
                    Esta acao nao pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(instance)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Create Instance Dialog Content
function CreateInstanceDialog({
  instanceName,
  setInstanceName,
  isCreating,
  createdInstanceId,
  onCreate,
  onClose,
}: {
  instanceName: string
  setInstanceName: (name: string) => void
  isCreating: boolean
  createdInstanceId: string | null
  onCreate: () => void
  onClose: () => void
}) {
  const { status, qrCode, instance } = useInstanceStatusPolling(
    createdInstanceId,
    !!createdInstanceId
  )

  // Se conectou, fechar dialog automaticamente
  useEffect(() => {
    if (status === 'connected') {
      setTimeout(() => {
        onClose()
      }, 2000)
    }
  }, [status, onClose])

  // Se ainda nao criou, mostra form
  if (!createdInstanceId) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Nova Conexao WhatsApp</DialogTitle>
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

  // Se conectou
  if (status === 'connected') {
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

  // Mostra QR Code
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Escaneie o QR Code
        </DialogTitle>
        <DialogDescription>
          Abra o WhatsApp no seu celular e escaneie o codigo abaixo
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

// Helper function for status styling
function getStatusConfig(status: InstanceStatus) {
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

// Access Management Dialog Component
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
          Controle quais membros da equipe podem acessar &quot;{instance.name}&quot;
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
