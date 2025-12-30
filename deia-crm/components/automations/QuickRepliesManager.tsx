'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
  MessageSquareText,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Search,
  Loader2,
  Hash,
  FolderOpen,
} from 'lucide-react'
import { useQuickReplies, type QuickReply, type QuickReplyInput } from '@/hooks/useQuickReplies'
import { cn } from '@/lib/utils'

const SUGGESTED_CATEGORIES = [
  'Saudacao',
  'Atendimento',
  'Vendas',
  'Suporte',
  'Financeiro',
  'Agendamento',
  'Geral',
]

export function QuickRepliesManager() {
  const {
    quickReplies,
    categories,
    isLoading,
    createQuickReply,
    updateQuickReply,
    deleteQuickReply,
    toggleActive,
    duplicateQuickReply,
  } = useQuickReplies()

  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<QuickReplyInput>({
    shortcut: '',
    title: '',
    content: '',
    category: null,
    is_active: true,
  })

  // Filter quick replies
  const filteredReplies = quickReplies.filter(qr => {
    const matchesSearch = !searchTerm ||
      qr.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      qr.shortcut.toLowerCase().includes(searchTerm.toLowerCase()) ||
      qr.content.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = !filterCategory || qr.category === filterCategory

    return matchesSearch && matchesCategory
  })

  // Group by category for display
  const groupedReplies = filteredReplies.reduce((acc, qr) => {
    const category = qr.category || 'Sem categoria'
    if (!acc[category]) acc[category] = []
    acc[category].push(qr)
    return acc
  }, {} as Record<string, QuickReply[]>)

  function openNewDialog() {
    setEditingReply(null)
    setFormData({
      shortcut: '',
      title: '',
      content: '',
      category: null,
      is_active: true,
    })
    setFormError(null)
    setIsDialogOpen(true)
  }

  function openEditDialog(reply: QuickReply) {
    setEditingReply(reply)
    setFormData({
      shortcut: reply.shortcut,
      title: reply.title,
      content: reply.content,
      category: reply.category,
      is_active: reply.is_active,
    })
    setFormError(null)
    setIsDialogOpen(true)
  }

  async function handleSave() {
    // Validacao
    if (!formData.shortcut.trim()) {
      setFormError('Atalho e obrigatorio')
      return
    }
    if (!formData.title.trim()) {
      setFormError('Titulo e obrigatorio')
      return
    }
    if (!formData.content.trim()) {
      setFormError('Conteudo e obrigatorio')
      return
    }

    setIsSaving(true)
    setFormError(null)

    try {
      if (editingReply) {
        await updateQuickReply(editingReply.id, formData)
      } else {
        await createQuickReply(formData)
      }
      setIsDialogOpen(false)
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          setFormError('Este atalho ja existe. Escolha outro.')
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

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir esta resposta rapida?')) return

    try {
      await deleteQuickReply(id)
    } catch {
      // Error handled silently
    }
  }

  async function handleDuplicate(id: string) {
    try {
      await duplicateQuickReply(id)
    } catch {
      // Error handled silently
    }
  }

  async function handleToggleActive(id: string) {
    try {
      await toggleActive(id)
    } catch {
      // Error handled silently
    }
  }

  // All available categories (existing + suggested)
  const allCategories = Array.from(new Set([...categories, ...SUGGESTED_CATEGORIES])).sort()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Respostas Rapidas</h3>
          <p className="text-sm text-muted-foreground">
            Crie atalhos para mensagens frequentes. Use /{'{'}atalho{'}'} no chat.
          </p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Resposta
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por titulo, atalho ou conteudo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={filterCategory || 'all'}
          onValueChange={(value) => setFilterCategory(value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : quickReplies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquareText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma resposta rapida</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie sua primeira resposta rapida para agilizar o atendimento
            </p>
            <Button onClick={openNewDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Resposta Rapida
            </Button>
          </CardContent>
        </Card>
      ) : filteredReplies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum resultado</h3>
            <p className="text-muted-foreground text-center">
              Nenhuma resposta rapida encontrada com os filtros aplicados
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedReplies).map(([category, replies]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium text-sm text-muted-foreground">{category}</h4>
                <Badge variant="secondary" className="text-xs">
                  {replies.length}
                </Badge>
              </div>
              <div className="grid gap-3">
                {replies.map((reply) => (
                  <Card key={reply.id} className={cn(!reply.is_active && "opacity-60")}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "p-2 rounded-lg shrink-0",
                          reply.is_active ? "bg-primary/10" : "bg-muted"
                        )}>
                          <Hash className={cn(
                            "h-4 w-4",
                            reply.is_active ? "text-primary" : "text-muted-foreground"
                          )} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">
                              /{reply.shortcut}
                            </code>
                            <span className="font-medium truncate">{reply.title}</span>
                            {!reply.is_active && (
                              <Badge variant="secondary">Inativa</Badge>
                            )}
                          </div>

                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {reply.content}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={reply.is_active}
                            onCheckedChange={() => handleToggleActive(reply.id)}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(reply)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(reply.id)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(reply.id)}
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
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog de criacao/edicao */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingReply ? 'Editar Resposta Rapida' : 'Nova Resposta Rapida'}
            </DialogTitle>
            <DialogDescription>
              {editingReply
                ? 'Edite os dados da resposta rapida'
                : 'Crie uma resposta rapida para usar no chat'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {formError && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shortcut">Atalho *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">/</span>
                  <Input
                    id="shortcut"
                    value={formData.shortcut}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      shortcut: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                    }))}
                    placeholder="saudacao"
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Apenas letras, numeros e underscore
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={formData.category || 'none'}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    category: value === 'none' ? null : value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {allCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Titulo *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Saudacao inicial"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Conteudo da mensagem *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Digite a mensagem que sera enviada..."
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Dica: Use {'{{nome}}'} para inserir o nome do contato automaticamente
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingReply ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
