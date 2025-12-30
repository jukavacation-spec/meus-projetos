'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  GripVertical,
  Loader2,
  Layers,
  Flag,
  CheckCircle,
  RefreshCw,
} from 'lucide-react'
import { useKanbanStages, STAGE_COLORS, type KanbanStage, type KanbanStageInput } from '@/hooks/useKanbanStages'
import { cn } from '@/lib/utils'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

export function KanbanStagesSettings() {
  const {
    stages,
    isLoading,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
  } = useKanbanStages()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingStage, setEditingStage] = useState<KanbanStage | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<KanbanStage | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null)

  const [formData, setFormData] = useState<KanbanStageInput>({
    name: '',
    description: '',
    color: '#6366f1',
    is_initial: false,
    is_final: false,
    auto_archive_days: null,
  })

  function openNewDialog() {
    setEditingStage(null)
    setFormData({
      name: '',
      description: '',
      color: '#6366f1',
      is_initial: stages.length === 0, // Primeiro status e inicial por padrao
      is_final: false,
      auto_archive_days: null,
    })
    setFormError(null)
    setIsDialogOpen(true)
  }

  function openEditDialog(stage: KanbanStage) {
    setEditingStage(stage)
    setFormData({
      name: stage.name,
      description: stage.description || '',
      color: stage.color,
      is_initial: stage.is_initial,
      is_final: stage.is_final,
      auto_archive_days: stage.auto_archive_days,
    })
    setFormError(null)
    setIsDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      setFormError('Nome e obrigatorio')
      return
    }

    setIsSaving(true)
    setFormError(null)

    try {
      if (editingStage) {
        await updateStage(editingStage.id, formData)
      } else {
        await createStage(formData)
      }
      setIsDialogOpen(false)
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          setFormError('Ja existe um status com este nome')
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError('Erro ao salvar. Tente novamente.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return

    try {
      await deleteStage(deleteConfirm.id)
      setDeleteConfirm(null)
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message)
      }
    }
  }

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    if (result.destination.index === result.source.index) return

    const newOrder = Array.from(stages)
    const [removed] = newOrder.splice(result.source.index, 1)
    newOrder.splice(result.destination.index, 0, removed)

    await reorderStages(newOrder.map(s => s.id))
  }

  async function handleSyncWithChatwoot() {
    setIsSyncing(true)
    setSyncResult(null)

    try {
      const response = await fetch('/api/chatwoot/labels/sync', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setSyncResult({
          success: true,
          message: `${data.created} labels criadas, ${data.updated} atualizadas`,
        })
      } else {
        setSyncResult({
          success: false,
          message: data.error || 'Erro ao sincronizar',
        })
      }
    } catch {
      setSyncResult({
        success: false,
        message: 'Erro de conexao',
      })
    } finally {
      setIsSyncing(false)
      // Limpar mensagem apos 5 segundos
      setTimeout(() => setSyncResult(null), 5000)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Status
              </CardTitle>
              <CardDescription>
                Configure os status dos contatos e conversas. Arraste para reordenar.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleSyncWithChatwoot}
                disabled={isSyncing || stages.length === 0}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                Sincronizar com Chatwoot
              </Button>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Status
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {syncResult && (
            <div
              className={cn(
                "mb-4 p-3 rounded-lg text-sm",
                syncResult.success
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              {syncResult.message}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : stages.length === 0 ? (
            <div className="text-center py-8">
              <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">Nenhum status configurado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie status para organizar seus contatos e conversas
              </p>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Status
              </Button>
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="stages">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2"
                  >
                    {stages.map((stage, index) => (
                      <Draggable key={stage.id} draggableId={stage.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={cn(
                              "flex items-center gap-3 p-3 border rounded-lg bg-card",
                              snapshot.isDragging && "shadow-lg"
                            )}
                          >
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab text-muted-foreground hover:text-foreground"
                            >
                              <GripVertical className="h-5 w-5" />
                            </div>

                            <div
                              className="w-4 h-4 rounded-full shrink-0"
                              style={{ backgroundColor: stage.color }}
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{stage.name}</span>
                                {stage.is_initial && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <Flag className="h-3 w-3" />
                                    Inicial
                                  </Badge>
                                )}
                                {stage.is_final && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Final
                                  </Badge>
                                )}
                              </div>
                              {stage.description && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {stage.description}
                                </p>
                              )}
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(stage)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteConfirm(stage)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </CardContent>
      </Card>

      {/* Dialog de criacao/edicao */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStage ? 'Editar Status' : 'Novo Status'}
            </DialogTitle>
            <DialogDescription>
              {editingStage
                ? 'Edite as informacoes do status'
                : 'Crie um novo status para contatos e conversas'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {formError && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Em Negociacao"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descricao</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descricao do estagio..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {STAGE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      formData.color === color.value
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_initial">Status Inicial</Label>
                <p className="text-sm text-muted-foreground">
                  Novas conversas entram com este status
                </p>
              </div>
              <Switch
                id="is_initial"
                checked={formData.is_initial}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_initial: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_final">Status Final</Label>
                <p className="text-sm text-muted-foreground">
                  Conversas com este status sao consideradas concluidas
                </p>
              </div>
              <Switch
                id="is_final"
                checked={formData.is_final}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_final: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingStage ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmacao de exclusao */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir status?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o status &quot;{deleteConfirm?.name}&quot;?
              Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
