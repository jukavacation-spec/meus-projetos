'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Phone,
  Mail,
  Calendar,
  Layers,
  Edit2,
  Save,
  MessageSquare,
  Clock,
  User,
  FileText,
  Bell,
  Plus,
  Loader2,
  Trash2,
  ExternalLink
} from 'lucide-react'
import { formatPhone } from '@/lib/utils/phone'
import { createClient } from '@/lib/supabase/client'
import { useKanbanStages } from '@/hooks/useKanbanStages'

type Contact = {
  id: string
  company_id: string
  phone: string
  phone_normalized?: string
  name: string | null
  email: string | null
  avatar_url: string | null
  stage_id: string | null
  labels: string[]
  custom_fields: Record<string, unknown>
  metadata: Record<string, unknown>
  source: string
  created_at: string
  updated_at: string
}

type Conversation = {
  id: string
  chatwoot_conversation_id: number | null
  status: string
  last_activity_at: string
  created_at: string
}

type Reminder = {
  id: string
  title: string
  due_at: string
  completed: boolean
}

type ContactModalProps = {
  contactId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onContactUpdated?: () => void
}

export function ContactModal({ contactId, open, onOpenChange, onContactUpdated }: ContactModalProps) {
  const [contact, setContact] = useState<Contact | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('info')

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editStageId, setEditStageId] = useState<string | null>(null)

  // Stages (Status)
  const { stages, isLoading: stagesLoading } = useKanbanStages()

  // Reminders state
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [newReminderTitle, setNewReminderTitle] = useState('')
  const [newReminderDate, setNewReminderDate] = useState('')

  // Fetch contact data
  useEffect(() => {
    async function fetchData() {
      if (!contactId || !open) return

      setIsLoading(true)
      const supabase = createClient()

      try {
        // Fetch contact
        const { data: contactData, error: contactError } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', contactId)
          .single()

        if (contactError) throw contactError
        setContact(contactData as Contact)

        // Initialize edit form
        setEditName(contactData.name || '')
        setEditEmail(contactData.email || '')
        setEditPhone(contactData.phone || '')
        setEditNotes((contactData.metadata as { notes?: string })?.notes || '')
        setEditStageId(contactData.stage_id || null)

        // Load reminders from metadata
        const savedReminders = (contactData.metadata as { reminders?: Reminder[] })?.reminders || []
        setReminders(savedReminders)

        // Fetch conversations
        const { data: convData } = await supabase
          .from('conversations')
          .select('id, chatwoot_conversation_id, status, last_activity_at, created_at')
          .eq('contact_id', contactId)
          .order('last_activity_at', { ascending: false })

        setConversations(convData || [])
      } catch {
        // Error handled silently
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [contactId, open])

  const handleSave = async () => {
    if (!contact) return

    setIsSaving(true)
    const supabase = createClient()

    try {
      const updatedMetadata = {
        ...contact.metadata,
        notes: editNotes,
        reminders: reminders
      }

      const { error } = await supabase
        .from('contacts')
        .update({
          name: editName || null,
          email: editEmail || null,
          phone: editPhone,
          stage_id: editStageId,
          metadata: updatedMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id)

      if (error) throw error

      // Update local state
      setContact({
        ...contact,
        name: editName || null,
        email: editEmail || null,
        phone: editPhone,
        stage_id: editStageId,
        metadata: updatedMetadata
      })

      setIsEditing(false)
      onContactUpdated?.()
    } catch {
      // Error handled silently
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddReminder = () => {
    if (!newReminderTitle.trim() || !newReminderDate) return

    const newReminder: Reminder = {
      id: `reminder-${Date.now()}`,
      title: newReminderTitle.trim(),
      due_at: newReminderDate,
      completed: false
    }

    setReminders([...reminders, newReminder])
    setNewReminderTitle('')
    setNewReminderDate('')
  }

  const handleToggleReminder = (id: string) => {
    setReminders(reminders.map(r =>
      r.id === id ? { ...r, completed: !r.completed } : r
    ))
  }

  const handleDeleteReminder = (id: string) => {
    setReminders(reminders.filter(r => r.id !== id))
  }

  const initials = contact?.name
    ? contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalhes do Contato</span>
            {!isEditing && contact && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : contact ? (
          <div className="flex-1 overflow-y-auto">
            {/* Header with Avatar */}
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={contact.avatar_url || undefined} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                {isEditing ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nome do contato"
                    className="text-lg font-semibold mb-2"
                  />
                ) : (
                  <h2 className="text-xl font-semibold">{contact.name || 'Sem nome'}</h2>
                )}
                <p className="text-muted-foreground">{formatPhone(contact.phone)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">{contact.source}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Criado {format(new Date(contact.created_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info">
                  <User className="h-4 w-4 mr-2" />
                  Info
                </TabsTrigger>
                <TabsTrigger value="status">
                  <Layers className="h-4 w-4 mr-2" />
                  Status
                </TabsTrigger>
                <TabsTrigger value="reminders">
                  <Bell className="h-4 w-4 mr-2" />
                  Lembretes
                </TabsTrigger>
                <TabsTrigger value="history">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Historico
                </TabsTrigger>
              </TabsList>

              {/* Info Tab */}
              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">
                      <Phone className="h-4 w-4 inline mr-2" />
                      Telefone
                    </Label>
                    {isEditing ? (
                      <Input
                        id="phone"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="+55 11 99999-9999"
                      />
                    ) : (
                      <p className="text-sm py-2">{formatPhone(contact.phone)}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="email">
                      <Mail className="h-4 w-4 inline mr-2" />
                      Email
                    </Label>
                    {isEditing ? (
                      <Input
                        id="email"
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                      />
                    ) : (
                      <p className="text-sm py-2">{contact.email || 'Nao informado'}</p>
                    )}
                  </div>

                  <Separator />

                  <div className="grid gap-2">
                    <Label htmlFor="notes">
                      <FileText className="h-4 w-4 inline mr-2" />
                      Observacoes
                    </Label>
                    {isEditing ? (
                      <Textarea
                        id="notes"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Adicione observacoes sobre este contato..."
                        rows={4}
                      />
                    ) : (
                      <p className="text-sm py-2 text-muted-foreground">
                        {(contact.metadata as { notes?: string })?.notes || 'Nenhuma observacao'}
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Status Tab */}
              <TabsContent value="status" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Status do Contato</Label>
                    {stagesLoading ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Carregando status...</span>
                      </div>
                    ) : isEditing ? (
                      <Select
                        value={editStageId || ''}
                        onValueChange={(value) => setEditStageId(value || null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um status" />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: stage.color }}
                                />
                                {stage.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="py-2">
                        {contact.stage_id ? (
                          (() => {
                            const stage = stages.find(s => s.id === contact.stage_id)
                            return stage ? (
                              <Badge
                                variant="secondary"
                                className="text-sm"
                                style={{
                                  backgroundColor: stage.color + '20',
                                  color: stage.color,
                                  borderColor: stage.color
                                }}
                              >
                                <div
                                  className="w-2 h-2 rounded-full mr-2"
                                  style={{ backgroundColor: stage.color }}
                                />
                                {stage.name}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">Status nao encontrado</span>
                            )
                          })()
                        ) : (
                          <span className="text-sm text-muted-foreground">Nenhum status definido</span>
                        )}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="text-sm text-muted-foreground">
                    <p>O status do contato e sincronizado com os labels do Chatwoot.</p>
                    <p className="mt-1">Para gerenciar os status disponiveis, acesse Configuracoes → Status.</p>
                  </div>
                </div>
              </TabsContent>

              {/* Reminders Tab */}
              <TabsContent value="reminders" className="space-y-4 mt-4">
                <div className="space-y-2">
                  {reminders.map((reminder) => (
                    <Card key={reminder.id} className={reminder.completed ? 'opacity-60' : ''}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={reminder.completed}
                          onChange={() => handleToggleReminder(reminder.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${reminder.completed ? 'line-through' : ''}`}>
                            {reminder.title}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(reminder.due_at), "d 'de' MMM 'as' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteReminder(reminder.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {reminders.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum lembrete agendado
                    </p>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Novo Lembrete</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newReminderTitle}
                      onChange={(e) => setNewReminderTitle(e.target.value)}
                      placeholder="Titulo do lembrete..."
                      className="flex-1"
                    />
                    <Input
                      type="datetime-local"
                      value={newReminderDate}
                      onChange={(e) => setNewReminderDate(e.target.value)}
                      className="w-auto"
                    />
                    <Button onClick={handleAddReminder} size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="space-y-4 mt-4">
                {conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma conversa encontrada
                  </p>
                ) : (
                  <div className="space-y-2">
                    {conversations.map((conv) => (
                      <Card key={conv.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant={conv.status === 'open' ? 'default' : 'secondary'}>
                                {conv.status === 'open' ? 'Aberta' :
                                 conv.status === 'resolved' ? 'Resolvida' : 'Pendente'}
                              </Badge>
                              {conv.chatwoot_conversation_id && (
                                <span className="text-xs text-muted-foreground">
                                  #{conv.chatwoot_conversation_id}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(conv.created_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                              <span className="mx-1">•</span>
                              <Clock className="h-3 w-3" />
                              Ultima atividade {format(new Date(conv.last_activity_at), "d/MM HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(`/inbox?conversation=${conv.id}`, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            Contato nao encontrado
          </div>
        )}

        {/* Footer with Save/Cancel buttons */}
        {isEditing && (
          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
