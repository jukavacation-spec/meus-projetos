'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  Key,
  Trash2,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type ApiKey = {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  is_active: boolean
  last_used_at: string | null
  expires_at: string | null
  created_at: string
  key?: string // Só presente quando acabou de criar
}

export function ApiKeysSettings() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchApiKeys = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/api-keys')
      const data = await response.json()

      if (data.success) {
        setApiKeys(data.apiKeys)
      }
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchApiKeys()
  }, [fetchApiKeys])

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error('Digite um nome para a chave')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })
      const data = await response.json()

      if (data.success) {
        setCreatedKey(data.apiKey.key)
        setApiKeys(prev => [data.apiKey, ...prev])
        toast.success('API Key criada com sucesso')
      } else {
        toast.error(data.error || 'Erro ao criar API Key')
      }
    } catch {
      toast.error('Erro ao criar API Key')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/settings/api-keys?id=${id}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success) {
        setApiKeys(prev => prev.filter(key => key.id !== id))
        toast.success('API Key removida')
      } else {
        toast.error(data.error || 'Erro ao remover API Key')
      }
    } catch {
      toast.error('Erro ao remover API Key')
    }
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Copiado para a area de transferencia')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDialogClose = () => {
    setIsCreateDialogOpen(false)
    setNewKeyName('')
    setCreatedKey(null)
    setCopied(false)
  }

  const getScopeLabel = (scope: string) => {
    const labels: Record<string, string> = {
      'leads:read': 'Ler Leads',
      'leads:write': 'Editar Leads',
      'messages:send': 'Enviar Mensagens',
      '*': 'Acesso Total',
    }
    return labels[scope] || scope
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
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Crie chaves de API para integrar com n8n, Zapier, Make e outros sistemas
              </CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova API Key
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                {createdKey ? (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-green-600">
                        <Check className="h-5 w-5" />
                        API Key Criada
                      </DialogTitle>
                      <DialogDescription>
                        Copie esta chave agora. Ela nao sera exibida novamente!
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm break-all">
                        <code className="flex-1">{createdKey}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(createdKey)}
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="flex gap-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            Guarde esta chave em um local seguro. Por seguranca, ela nao pode ser visualizada novamente.
                          </p>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleDialogClose}>
                        Fechar
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Nova API Key</DialogTitle>
                      <DialogDescription>
                        Crie uma chave para integrar sistemas externos
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="keyName">Nome da chave</Label>
                        <Input
                          id="keyName"
                          placeholder="Ex: n8n, Zapier, Make..."
                          value={newKeyName}
                          onChange={(e) => setNewKeyName(e.target.value)}
                          disabled={isCreating}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Permissoes</Label>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">Ler Leads</Badge>
                          <Badge variant="secondary">Editar Leads</Badge>
                          <Badge variant="secondary">Enviar Mensagens</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Todas as permissoes serao concedidas por padrao
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={handleDialogClose} disabled={isCreating}>
                        Cancelar
                      </Button>
                      <Button onClick={handleCreate} disabled={isCreating || !newKeyName.trim()}>
                        {isCreating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Criando...
                          </>
                        ) : (
                          'Criar API Key'
                        )}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* API Keys List */}
      {apiKeys.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Key className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Nenhuma API Key
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie uma API Key para integrar com sistemas externos
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {apiKeys.map((apiKey) => (
            <Card key={apiKey.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Key className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{apiKey.name}</h3>
                        {!apiKey.is_active && (
                          <Badge variant="secondary">Inativa</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <code className="bg-muted px-2 py-0.5 rounded text-xs">
                          {apiKey.key_prefix}...
                        </code>
                        {apiKey.last_used_at ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Usado {formatDistanceToNow(new Date(apiKey.last_used_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">Nunca usada</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex flex-wrap gap-1 mr-4">
                      {apiKey.scopes.slice(0, 3).map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs">
                          {getScopeLabel(scope)}
                        </Badge>
                      ))}
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover API Key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A chave &quot;{apiKey.name}&quot; sera removida permanentemente.
                            Qualquer integracao usando esta chave deixara de funcionar.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(apiKey.id)}
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
          ))}
        </div>
      )}

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentacao da API</CardTitle>
          <CardDescription>
            Como usar a API de automacoes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Listar leads por estagio</p>
              <code className="text-xs text-muted-foreground">
                GET /api/automations/leads?stage=follow-up
              </code>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Mover lead de estagio</p>
              <code className="text-xs text-muted-foreground">
                POST /api/automations/leads/&#123;id&#125;/stage
              </code>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Enviar mensagem</p>
              <code className="text-xs text-muted-foreground">
                POST /api/automations/send-message
              </code>
            </div>
          </div>
          <div className="pt-2">
            <p className="text-sm text-muted-foreground">
              Use o header <code className="bg-muted px-1 rounded">Authorization: Bearer sua_api_key</code> em todas as requisicoes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
