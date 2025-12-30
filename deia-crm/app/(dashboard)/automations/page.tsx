'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Zap,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  MessageSquare,
  MessageSquareText,
  Tag,
  User,
  Clock,
  Search,
  ArrowRight,
  Loader2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { QuickRepliesManager } from '@/components/automations/QuickRepliesManager'

type Automation = {
  id: string
  name: string
  description: string | null
  trigger_type: string
  trigger_config: Record<string, unknown>
  conditions: unknown[]
  actions: unknown[]
  is_active: boolean
  priority: number
  execution_count: number
  last_executed_at: string | null
  created_at: string
}

const TRIGGER_TYPES = [
  { value: 'new_conversation', label: 'Nova conversa', icon: MessageSquare, description: 'Quando uma nova conversa é iniciada' },
  { value: 'keyword', label: 'Palavra-chave', icon: Search, description: 'Quando mensagem contém palavra específica' },
  { value: 'no_response', label: 'Sem resposta', icon: Clock, description: 'Quando não há resposta após X tempo' },
  { value: 'stage_change', label: 'Mudança de estágio', icon: ArrowRight, description: 'Quando conversa muda de estágio' },
]

const ACTION_TYPES = [
  { value: 'send_message', label: 'Enviar mensagem', icon: MessageSquare },
  { value: 'add_tag', label: 'Adicionar tag', icon: Tag },
  { value: 'assign_agent', label: 'Atribuir agente', icon: User },
  { value: 'change_stage', label: 'Mudar estágio', icon: ArrowRight },
]

type KanbanStage = {
  id: string
  name: string
  order: number
}

export default function AutomationsPage() {
  const { hasPermission } = useAuth()
  const canManageAutomations = hasPermission('settings', 'read')

  const [automations, setAutomations] = useState<Automation[]>([])
  const [kanbanStages, setKanbanStages] = useState<KanbanStage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'new_conversation',
    trigger_config: {} as Record<string, string>,
    actions: [{ type: 'send_message', config: { message: '' } }] as Array<{ type: string; config: Record<string, string> }>
  })

  useEffect(() => {
    fetchAutomations()
    fetchKanbanStages()
  }, [])

  async function fetchAutomations() {
    setIsLoading(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .order('priority', { ascending: true })

      if (error) throw error
      setAutomations((data || []) as Automation[])
    } catch {
    } finally {
      setIsLoading(false)
    }
  }

  async function fetchKanbanStages() {
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!userData?.company_id) return

      const { data, error } = await supabase
        .from('kanban_stages')
        .select('id, name, order')
        .eq('company_id', userData.company_id)
        .order('order', { ascending: true })

      if (error) throw error
      setKanbanStages((data || []) as KanbanStage[])
    } catch {
    }
  }

  function openNewDialog() {
    setEditingAutomation(null)
    setFormData({
      name: '',
      description: '',
      trigger_type: 'new_conversation',
      trigger_config: {},
      actions: [{ type: 'send_message', config: { message: '' } }]
    })
    setIsDialogOpen(true)
  }

  function openEditDialog(automation: Automation) {
    setEditingAutomation(automation)
    setFormData({
      name: automation.name,
      description: automation.description || '',
      trigger_type: automation.trigger_type,
      trigger_config: automation.trigger_config as Record<string, string>,
      actions: automation.actions as Array<{ type: string; config: Record<string, string> }>
    })
    setIsDialogOpen(true)
  }

  async function handleSave() {
    setIsSaving(true)
    const supabase = createClient()

    try {
      // Get company_id from current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!userData?.company_id) throw new Error('Company not found')

      const automationData = {
        name: formData.name,
        description: formData.description || null,
        trigger_type: formData.trigger_type,
        trigger_config: formData.trigger_config,
        actions: formData.actions,
        company_id: userData.company_id
      }

      if (editingAutomation) {
        // Update existing
        const { error } = await supabase
          .from('automations')
          .update(automationData)
          .eq('id', editingAutomation.id)

        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('automations')
          .insert(automationData)

        if (error) throw error
      }

      await fetchAutomations()
      setIsDialogOpen(false)
    } catch {
    } finally {
      setIsSaving(false)
    }
  }

  async function toggleActive(automation: Automation) {
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('automations')
        .update({ is_active: !automation.is_active })
        .eq('id', automation.id)

      if (error) throw error
      setAutomations(prev =>
        prev.map(a => a.id === automation.id ? { ...a, is_active: !a.is_active } : a)
      )
    } catch {
    }
  }

  async function deleteAutomation(id: string) {
    if (!confirm('Tem certeza que deseja excluir esta automação?')) return

    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('automations')
        .delete()
        .eq('id', id)

      if (error) throw error
      setAutomations(prev => prev.filter(a => a.id !== id))
    } catch {
    }
  }

  async function duplicateAutomation(automation: Automation) {
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!userData?.company_id) throw new Error('Company not found')

      const { error } = await supabase
        .from('automations')
        .insert({
          name: `${automation.name} (cópia)`,
          description: automation.description,
          trigger_type: automation.trigger_type,
          trigger_config: automation.trigger_config,
          actions: automation.actions,
          is_active: false,
          company_id: userData.company_id
        })

      if (error) throw error
      await fetchAutomations()
    } catch {
    }
  }

  const getTriggerInfo = (type: string) => TRIGGER_TYPES.find(t => t.value === type)

  return (
    <>
      <Header title="Respostas e Automacoes" />

      <div className="p-6 space-y-6">
        <Tabs defaultValue="quick-replies" className="space-y-6">
          <TabsList>
            <TabsTrigger value="quick-replies" className="gap-2">
              <MessageSquareText className="h-4 w-4" />
              Respostas Rapidas
            </TabsTrigger>
            {canManageAutomations && (
              <TabsTrigger value="automations" className="gap-2">
                <Zap className="h-4 w-4" />
                Automacoes
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="quick-replies">
            <QuickRepliesManager />
          </TabsContent>

          {canManageAutomations && (
          <TabsContent value="automations" className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Automacoes</h2>
                <p className="text-muted-foreground">
                  Configure respostas automaticas e fluxos de trabalho
                </p>
              </div>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Automacao
              </Button>
            </div>

        {/* Lista de automações */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : automations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Zap className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma automação</h3>
              <p className="text-muted-foreground text-center mb-4">
                Crie sua primeira automação para agilizar o atendimento
              </p>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Automação
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {automations.map((automation) => {
              const triggerInfo = getTriggerInfo(automation.trigger_type)
              const TriggerIcon = triggerInfo?.icon || Zap

              return (
                <Card key={automation.id} className={cn(!automation.is_active && "opacity-60")}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "p-2 rounded-lg shrink-0",
                        automation.is_active ? "bg-primary/10" : "bg-muted"
                      )}>
                        <TriggerIcon className={cn(
                          "h-5 w-5",
                          automation.is_active ? "text-primary" : "text-muted-foreground"
                        )} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{automation.name}</h3>
                          {automation.is_active ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                              Ativa
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inativa</Badge>
                          )}
                        </div>

                        {automation.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                            {automation.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <TriggerIcon className="h-3 w-3" />
                            {triggerInfo?.label}
                          </span>
                          <span>•</span>
                          <span>{automation.actions?.length || 0} ação(ões)</span>
                          <span>•</span>
                          <span>{automation.execution_count} execuções</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={automation.is_active}
                          onCheckedChange={() => toggleActive(automation)}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(automation)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateAutomation(automation)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteAutomation(automation.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Templates sugeridos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Templates Populares</CardTitle>
            <CardDescription>Comece com uma automação pré-configurada</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TemplateCard
                title="Boas-vindas"
                description="Envie uma mensagem de boas-vindas para novos contatos"
                icon={MessageSquare}
                onClick={() => {
                  setFormData({
                    name: 'Mensagem de Boas-vindas',
                    description: 'Envia automaticamente uma mensagem quando uma nova conversa é iniciada',
                    trigger_type: 'new_conversation',
                    trigger_config: {},
                    actions: [{ type: 'send_message', config: { message: 'Olá! 👋 Seja bem-vindo! Como posso ajudar você hoje?' } }]
                  })
                  setIsDialogOpen(true)
                }}
              />
              <TemplateCard
                title="Tag Automática"
                description="Adicione tags baseado em palavras-chave"
                icon={Tag}
                onClick={() => {
                  setFormData({
                    name: 'Tag por Palavra-chave',
                    description: 'Adiciona tag quando mensagem contém palavra específica',
                    trigger_type: 'keyword',
                    trigger_config: { keyword: 'orçamento' },
                    actions: [{ type: 'add_tag', config: { tag: 'interessado' } }]
                  })
                  setIsDialogOpen(true)
                }}
              />
              <TemplateCard
                title="Confirmar e Avançar"
                description="Responde /ok com agradecimento e move para próximo estágio"
                icon={ArrowRight}
                onClick={() => {
                  setFormData({
                    name: 'Confirmar e Avançar',
                    description: 'Quando cliente digita /ok, agradece e move para próximo estágio',
                    trigger_type: 'keyword',
                    trigger_config: { keyword: '/ok' },
                    actions: [
                      { type: 'send_message', config: { message: 'Obrigado pela confirmação! ✅ Vou dar andamento no seu atendimento.' } },
                      { type: 'change_stage', config: { stage: 'next' } }
                    ]
                  })
                  setIsDialogOpen(true)
                }}
              />
              <TemplateCard
                title="Atribuição Automática"
                description="Atribua conversas a um agente específico"
                icon={User}
                onClick={() => {
                  setFormData({
                    name: 'Atribuição Automática',
                    description: 'Atribui novas conversas automaticamente',
                    trigger_type: 'new_conversation',
                    trigger_config: {},
                    actions: [{ type: 'assign_agent', config: { agent_id: '' } }]
                  })
                  setIsDialogOpen(true)
                }}
              />
            </div>
          </CardContent>
        </Card>
          </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Dialog de criacao/edicao */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAutomation ? 'Editar Automação' : 'Nova Automação'}
            </DialogTitle>
            <DialogDescription>
              Configure quando e como a automação deve ser executada
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Nome e descrição */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da automação</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Mensagem de boas-vindas"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva o que esta automação faz..."
                  rows={2}
                />
              </div>
            </div>

            {/* Trigger */}
            <div className="space-y-4">
              <Label>Quando executar (Trigger)</Label>
              <Select
                value={formData.trigger_type}
                onValueChange={(value) => setFormData(prev => ({
                  ...prev,
                  trigger_type: value,
                  trigger_config: {}
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((trigger) => (
                    <SelectItem key={trigger.value} value={trigger.value}>
                      <div className="flex items-center gap-2">
                        <trigger.icon className="h-4 w-4" />
                        {trigger.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Configuração específica do trigger */}
              {formData.trigger_type === 'keyword' && (
                <div className="space-y-2">
                  <Label htmlFor="keyword">Palavra-chave</Label>
                  <Input
                    id="keyword"
                    value={formData.trigger_config.keyword || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      trigger_config: { ...prev.trigger_config, keyword: e.target.value }
                    }))}
                    placeholder="Ex: orçamento, preço, comprar"
                  />
                </div>
              )}

              {formData.trigger_type === 'no_response' && (
                <div className="space-y-2">
                  <Label htmlFor="delay">Tempo de espera (minutos)</Label>
                  <Input
                    id="delay"
                    type="number"
                    value={formData.trigger_config.delay_minutes || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      trigger_config: { ...prev.trigger_config, delay_minutes: e.target.value }
                    }))}
                    placeholder="Ex: 30"
                  />
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="space-y-4">
              <Label>Ações</Label>
              {formData.actions.map((action, index) => (
                <Card key={index}>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Select
                        value={action.type}
                        onValueChange={(value) => {
                          const newActions = [...formData.actions]
                          newActions[index] = { type: value, config: {} }
                          setFormData(prev => ({ ...prev, actions: newActions }))
                        }}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTION_TYPES.map((actionType) => (
                            <SelectItem key={actionType.value} value={actionType.value}>
                              <div className="flex items-center gap-2">
                                <actionType.icon className="h-4 w-4" />
                                {actionType.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {formData.actions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newActions = formData.actions.filter((_, i) => i !== index)
                            setFormData(prev => ({ ...prev, actions: newActions }))
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Configuração específica da ação */}
                    {action.type === 'send_message' && (
                      <div className="space-y-2">
                        <Label>Mensagem</Label>
                        <Textarea
                          value={action.config.message || ''}
                          onChange={(e) => {
                            const newActions = [...formData.actions]
                            newActions[index].config.message = e.target.value
                            setFormData(prev => ({ ...prev, actions: newActions }))
                          }}
                          placeholder="Digite a mensagem que será enviada..."
                          rows={3}
                        />
                      </div>
                    )}

                    {action.type === 'add_tag' && (
                      <div className="space-y-2">
                        <Label>Tag</Label>
                        <Input
                          value={action.config.tag || ''}
                          onChange={(e) => {
                            const newActions = [...formData.actions]
                            newActions[index].config.tag = e.target.value
                            setFormData(prev => ({ ...prev, actions: newActions }))
                          }}
                          placeholder="Nome da tag"
                        />
                      </div>
                    )}

                    {action.type === 'change_stage' && (
                      <div className="space-y-2">
                        <Label>Mover para estágio</Label>
                        <Select
                          value={action.config.stage || ''}
                          onValueChange={(value) => {
                            const newActions = [...formData.actions]
                            newActions[index].config.stage = value
                            setFormData(prev => ({ ...prev, actions: newActions }))
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o estágio" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="next">➡️ Próximo estágio (automático)</SelectItem>
                            <SelectItem value="previous">⬅️ Estágio anterior</SelectItem>
                            {kanbanStages.length > 0 && (
                              <>
                                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1">
                                  Estágios específicos
                                </div>
                                {kanbanStages.map((stage) => (
                                  <SelectItem key={stage.id} value={stage.id}>
                                    {stage.name}
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          &quot;Próximo estágio&quot; move automaticamente para o próximo na sequência
                        </p>
                      </div>
                    )}

                    {action.type === 'assign_agent' && (
                      <div className="space-y-2">
                        <Label>ID do Agente</Label>
                        <Input
                          value={action.config.agent_id || ''}
                          onChange={(e) => {
                            const newActions = [...formData.actions]
                            newActions[index].config.agent_id = e.target.value
                            setFormData(prev => ({ ...prev, actions: newActions }))
                          }}
                          placeholder="ID do agente"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              <Button
                variant="outline"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    actions: [...prev.actions, { type: 'send_message', config: {} }]
                  }))
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Ação
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!formData.name || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingAutomation ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TemplateCard({
  title,
  description,
  icon: Icon,
  onClick
}: {
  title: string
  description: string
  icon: React.ElementType
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="p-4 border rounded-lg text-left hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h4 className="font-medium">{title}</h4>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </button>
  )
}
