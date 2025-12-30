'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Phone,
  Mail,
  X,
  Loader2,
  Pencil,
  AlertCircle,
  Flag,
  Kanban,
  StickyNote,
  MessageSquare,
  Users,
  Save,
  Check,
  ChevronDown,
  Search
} from 'lucide-react'
import { formatPhone } from '@/lib/utils/phone'
import { cn } from '@/lib/utils'
import { ContactEditDialog } from './ContactEditDialog'
import { useKanbanStages } from '@/hooks/useKanbanStages'
import { createClient } from '@/lib/supabase/client'

type Agent = {
  id: number
  name: string
  email: string
  avatar_url: string | null
  availability_status: string
}

type Label = {
  id: number
  title: string
  color: string
}

type Contact = {
  id: string
  phone: string
  name: string | null
  email?: string | null
  avatar_url: string | null
  created_at?: string
}

type Stage = {
  id: string
  name: string
  color: string
}

type PreviousConversation = {
  id: string
  chatwoot_conversation_id: number
  status: string
  created_at: string
  last_activity_at: string
}

type Participant = {
  id: number
  name: string
  email: string
  avatar_url: string | null
  role: string
}

type Conversation = {
  id: string
  contact?: Contact
  stage?: Stage
  stage_id?: string | null
  status: string
  priority: string
  tags?: string[]
  created_at: string
  chatwoot_conversation_id?: number | null
  chatwoot_inbox_id?: number | null
  assigned_to?: string | null
}

type ContactDetailsProps = {
  conversation: Conversation | null
  onClose: () => void
  onUpdate?: () => void
}

export function ContactDetails({ conversation, onClose, onUpdate }: ContactDetailsProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [localContact, setLocalContact] = useState<Contact | null>(null)
  const [currentStageId, setCurrentStageId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [previousConversations, setPreviousConversations] = useState<PreviousConversation[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [assignedAgent, setAssignedAgent] = useState<Agent | null>(null)
  const [agentSearchQuery, setAgentSearchQuery] = useState('')
  const [isAgentPopoverOpen, setIsAgentPopoverOpen] = useState(false)

  // Hook para buscar status
  const { stages, isLoading: stagesLoading } = useKanbanStages()

  // Sync local contact when conversation changes
  useEffect(() => {
    setLocalContact(conversation?.contact || null)
    setCurrentStageId(conversation?.stage_id || null)
  }, [conversation?.contact, conversation?.stage_id])

  // Fetch agents and labels on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [agentsRes, labelsRes] = await Promise.all([
          fetch('/api/chatwoot/agents'),
          fetch('/api/chatwoot/labels')
        ])

        if (agentsRes.ok) {
          const data = await agentsRes.json()
          setAgents(data.agents || [])
        }

        if (labelsRes.ok) {
          const data = await labelsRes.json()
          setLabels(data.labels || [])
        }
      } catch {
        // Error handled silently
      }
    }

    fetchData()
  }, [])

  // Find assigned agent when conversation.assigned_to or agents change
  useEffect(() => {
    async function findAssignedAgent() {
      if (!conversation?.assigned_to) {
        setAssignedAgent(null)
        return
      }

      // First try to find in loaded agents by matching user_id with chatwoot_agent_id
      // We need to fetch the user's chatwoot_agent_id from Supabase
      const supabase = createClient()
      const { data: user } = await supabase
        .from('users')
        .select('chatwoot_agent_id, name')
        .eq('id', conversation.assigned_to)
        .single()

      if (user?.chatwoot_agent_id) {
        // Find in agents list
        const agent = agents.find(a => a.id === user.chatwoot_agent_id)
        if (agent) {
          setAssignedAgent(agent)
          return
        }
      }

      // If not found in agents list, create a minimal agent object from user data
      if (user) {
        setAssignedAgent({
          id: user.chatwoot_agent_id || 0,
          name: user.name || 'Agente',
          email: '',
          avatar_url: null,
          availability_status: 'online'
        })
      } else {
        setAssignedAgent(null)
      }
    }

    findAssignedAgent()
  }, [conversation?.assigned_to, agents])

  // Fetch notes and previous conversations
  useEffect(() => {
    async function fetchContactData() {
      if (!conversation?.contact?.id) return

      const supabase = createClient()

      // Fetch notes from contact
      const { data: contactData } = await supabase
        .from('contacts')
        .select('metadata')
        .eq('id', conversation.contact.id)
        .single()

      if (contactData?.metadata?.notes) {
        setNotes(contactData.metadata.notes)
      } else {
        setNotes('')
      }

      // Fetch previous conversations for this contact
      const { data: prevConvs } = await supabase
        .from('conversations')
        .select('id, chatwoot_conversation_id, status, created_at, last_activity_at')
        .eq('contact_id', conversation.contact.id)
        .neq('id', conversation.id)
        .order('last_activity_at', { ascending: false })
        .limit(5)

      setPreviousConversations(prevConvs || [])
    }

    fetchContactData()
  }, [conversation?.contact?.id, conversation?.id])

  // Fetch participants (agents assigned to conversation)
  useEffect(() => {
    async function fetchParticipants() {
      if (!conversation?.chatwoot_conversation_id) {
        setParticipants([])
        return
      }

      // For now, show the agents list as potential participants
      // In a real implementation, you'd fetch the actual assigned agents
      setParticipants(agents.slice(0, 3).map(a => ({
        id: a.id,
        name: a.name,
        email: a.email,
        avatar_url: a.avatar_url,
        role: 'Agente'
      })))
    }

    fetchParticipants()
  }, [conversation?.chatwoot_conversation_id, agents])

  const handleUnassignAgent = async () => {
    if (!conversation?.chatwoot_conversation_id) return

    setIsLoading(true)
    try {
      const res = await fetch(`/api/chatwoot/conversations/${conversation.chatwoot_conversation_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unassign' })
      })

      if (res.ok) {
        setAssignedAgent(null)
        setIsAgentPopoverOpen(false)
        setAgentSearchQuery('')
        onUpdate?.()
      }
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false)
    }
  }

  const handleAssignAgent = async (agentId: number) => {
    if (!conversation?.chatwoot_conversation_id) return

    // Toggle: se clicar no mesmo agente, desatribui
    if (assignedAgent?.id === agentId) {
      return handleUnassignAgent()
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/chatwoot/conversations/${conversation.chatwoot_conversation_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', assigneeId: agentId })
      })

      if (res.ok) {
        // Update local assigned agent immediately for better UX
        const agent = agents.find(a => a.id === agentId)
        if (agent) {
          setAssignedAgent(agent)
        }
        setIsAgentPopoverOpen(false)
        setAgentSearchQuery('')
        onUpdate?.()
      }
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false)
    }
  }

  // Filter agents based on search query
  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(agentSearchQuery.toLowerCase()) ||
    agent.email.toLowerCase().includes(agentSearchQuery.toLowerCase())
  )

  const handleContactSave = (updatedContact: Contact) => {
    setLocalContact(updatedContact)
    onUpdate?.()
  }

  const handleChangePriority = async (priority: 'none' | 'low' | 'medium' | 'high' | 'urgent') => {
    if (!conversation?.chatwoot_conversation_id) return

    setIsLoading(true)
    try {
      const res = await fetch(`/api/chatwoot/conversations/${conversation.chatwoot_conversation_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'priority', priority })
      })

      if (res.ok) {
        onUpdate?.()
      }
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangeStage = async (stageId: string) => {
    if (!conversation) return

    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('conversations')
        .update({
          stage_id: stageId,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.id)

      if (error) throw error

      // Sincronizar com Chatwoot (atualizar labels)
      // A API sync-stage espera o ID interno (UUID) e busca o chatwoot_conversation_id internamente
      fetch(`/api/chatwoot/conversations/${conversation.id}/sync-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId })
      }).catch(() => {
        // Sincronização com Chatwoot falhou silenciosamente
        // O banco local já foi atualizado
      })

      setCurrentStageId(stageId)
      onUpdate?.()
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!conversation?.contact?.id) return

    setIsSavingNotes(true)
    try {
      const supabase = createClient()

      // Get current metadata
      const { data: contactData } = await supabase
        .from('contacts')
        .select('metadata')
        .eq('id', conversation.contact.id)
        .single()

      const currentMetadata = contactData?.metadata || {}

      // Update with notes
      const { error } = await supabase
        .from('contacts')
        .update({
          metadata: { ...currentMetadata, notes },
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.contact.id)

      if (error) throw error
    } catch {
      // Error handled silently
    } finally {
      setIsSavingNotes(false)
    }
  }

  if (!conversation) {
    return null
  }

  const contact = localContact
  const initials = contact?.name
    ? contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600'
      case 'high': return 'text-orange-500'
      case 'medium': return 'text-yellow-500'
      case 'low': return 'text-blue-500'
      default: return 'text-muted-foreground'
    }
  }

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Urgente'
      case 'high': return 'Alta'
      case 'medium': return 'Media'
      case 'low': return 'Baixa'
      default: return 'Nenhuma'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberta'
      case 'resolved': return 'Resolvida'
      case 'pending': return 'Pendente'
      default: return status
    }
  }

  return (
    <div className="w-[280px] shrink-0 border-l bg-background flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="h-14 shrink-0 px-4 flex items-center justify-end border-b">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {/* Contact Header */}
          <div className="flex flex-col items-center text-center mb-4">
            <Avatar className="h-20 w-20 mb-3">
              <AvatarImage src={contact?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{contact?.name || 'Sem nome'}</h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowEditDialog(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-2 mb-4">
            {contact?.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{formatPhone(contact.phone)}</span>
              </div>
            )}

            {contact?.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground truncate">{contact.email}</span>
              </div>
            )}
          </div>

          {/* Status and Stage - Always Visible */}
          <div className="flex flex-wrap gap-2 mb-4">
            {/* Conversation Status */}
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                conversation.status === 'open' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                conversation.status === 'resolved' && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
                conversation.status === 'pending' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              )}
            >
              {conversation.status === 'open' && 'Aberta'}
              {conversation.status === 'resolved' && 'Resolvida'}
              {conversation.status === 'pending' && 'Pendente'}
              {!['open', 'resolved', 'pending'].includes(conversation.status) && conversation.status}
            </Badge>

            {/* Kanban Stage */}
            {currentStageId && stages.find(s => s.id === currentStageId) && (
              <Badge
                variant="secondary"
                className="text-xs"
                style={{
                  backgroundColor: stages.find(s => s.id === currentStageId)?.color + '20',
                  color: stages.find(s => s.id === currentStageId)?.color
                }}
              >
                {stages.find(s => s.id === currentStageId)?.name}
              </Badge>
            )}
          </div>

          {/* Assigned Agent Section - Chatwoot Style */}
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Agente Atribuido
            </p>
            <Popover open={isAgentPopoverOpen} onOpenChange={(open) => {
              setIsAgentPopoverOpen(open)
              if (!open) setAgentSearchQuery('')
            }}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between h-10 px-3"
                  disabled={isLoading}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : assignedAgent ? (
                      <>
                        <div className="relative shrink-0">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={assignedAgent.avatar_url || undefined} />
                            <AvatarFallback className="text-xs bg-primary/10">
                              {assignedAgent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                            assignedAgent.availability_status === 'online' ? 'bg-green-500' :
                            assignedAgent.availability_status === 'busy' ? 'bg-yellow-500' : 'bg-gray-400'
                          )} />
                        </div>
                        <span className="truncate text-sm">{assignedAgent.name}</span>
                      </>
                    ) : (
                      <>
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <span className="text-xs text-muted-foreground">N</span>
                        </div>
                        <span className="text-sm text-muted-foreground">Nenhum</span>
                      </>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <span className="text-sm font-medium">Selecionar agente</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsAgentPopoverOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Search */}
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar agentes"
                      value={agentSearchQuery}
                      onChange={(e) => setAgentSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                </div>

                {/* Agent List */}
                <div className="max-h-[240px] overflow-y-auto py-1">
                  {/* None Option - Always visible */}
                  <button
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors",
                      !assignedAgent && "bg-muted/30"
                    )}
                    onClick={handleUnassignAgent}
                    disabled={isLoading}
                  >
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-muted-foreground">N</span>
                    </div>
                    <span className="text-sm flex-1 text-left">Nenhum</span>
                    {!assignedAgent && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>

                  {/* Agents */}
                  {filteredAgents.length === 0 && agentSearchQuery ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhum agente encontrado
                    </p>
                  ) : (
                    filteredAgents.map((agent) => (
                      <button
                        key={agent.id}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors",
                          assignedAgent?.id === agent.id && "bg-muted/30"
                        )}
                        onClick={() => handleAssignAgent(agent.id)}
                        disabled={isLoading}
                      >
                        <div className="relative shrink-0">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={agent.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {agent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                            agent.availability_status === 'online' ? 'bg-green-500' :
                            agent.availability_status === 'busy' ? 'bg-yellow-500' : 'bg-gray-400'
                          )} />
                        </div>
                        <span className="text-sm flex-1 text-left truncate">{agent.name}</span>
                        {assignedAgent?.id === agent.id && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Accordion Sections */}
          <Accordion type="multiple" className="w-full">
            {/* Status Section */}
            <AccordionItem value="kanban" className="border-b">
              <AccordionTrigger className="text-sm font-medium py-3">
                <div className="flex items-center gap-2">
                  <Kanban className="h-4 w-4" />
                  Status
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pb-2">
                  <Select
                    value={currentStageId || ''}
                    onValueChange={handleChangeStage}
                    disabled={isLoading || stagesLoading}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecionar status">
                        {currentStageId && stages.find(s => s.id === currentStageId) ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: stages.find(s => s.id === currentStageId)?.color }}
                            />
                            {stages.find(s => s.id === currentStageId)?.name}
                          </div>
                        ) : (
                          'Selecionar status'
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Priority Section */}
            <AccordionItem value="priority" className="border-b">
              <AccordionTrigger className="text-sm font-medium py-3">
                <div className="flex items-center gap-2">
                  <Flag className={`h-4 w-4 ${getPriorityColor(conversation.priority)}`} />
                  Prioridade
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pb-2">
                  <Select
                    value={conversation.priority || 'none'}
                    onValueChange={(value) => handleChangePriority(value as 'none' | 'low' | 'medium' | 'high' | 'urgent')}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          {conversation.priority === 'urgent' && <AlertCircle className="h-4 w-4 text-red-600" />}
                          {conversation.priority === 'high' && <Flag className="h-4 w-4 text-orange-500" />}
                          {conversation.priority === 'medium' && <Flag className="h-4 w-4 text-yellow-500" />}
                          {conversation.priority === 'low' && <Flag className="h-4 w-4 text-blue-500" />}
                          {(!conversation.priority || conversation.priority === 'none') && <Flag className="h-4 w-4 text-muted-foreground" />}
                          {getPriorityLabel(conversation.priority)}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          Urgente
                        </div>
                      </SelectItem>
                      <SelectItem value="high">
                        <div className="flex items-center gap-2">
                          <Flag className="h-4 w-4 text-orange-500" />
                          Alta
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex items-center gap-2">
                          <Flag className="h-4 w-4 text-yellow-500" />
                          Média
                        </div>
                      </SelectItem>
                      <SelectItem value="low">
                        <div className="flex items-center gap-2">
                          <Flag className="h-4 w-4 text-blue-500" />
                          Baixa
                        </div>
                      </SelectItem>
                      <SelectItem value="none">
                        <div className="flex items-center gap-2">
                          <Flag className="h-4 w-4 text-muted-foreground" />
                          Nenhuma
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Notes Section */}
            <AccordionItem value="notes" className="border-b">
              <AccordionTrigger className="text-sm font-medium py-3">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4" />
                  Notas do Contato
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pb-2 space-y-2">
                  <Textarea
                    placeholder="Adicione notas sobre este contato..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[80px] text-sm resize-none"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                  >
                    {isSavingNotes ? (
                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5 mr-2" />
                    )}
                    Salvar notas
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Participants Section */}
            <AccordionItem value="participants" className="border-b">
              <AccordionTrigger className="text-sm font-medium py-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Participantes ({participants.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pb-2 space-y-2">
                  {participants.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum participante</p>
                  ) : (
                    participants.map((participant) => (
                      <div key={participant.id} className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={participant.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {participant.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{participant.name}</p>
                          <p className="text-xs text-muted-foreground">{participant.role}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Previous Conversations Section */}
            <AccordionItem value="history" className="border-b-0">
              <AccordionTrigger className="text-sm font-medium py-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Conversas Anteriores ({previousConversations.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pb-2 space-y-2">
                  {previousConversations.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma conversa anterior</p>
                  ) : (
                    previousConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className="p-2 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">#{conv.chatwoot_conversation_id}</span>
                          <Badge variant="secondary" className="text-[10px] h-5">
                            {getStatusLabel(conv.status)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(conv.last_activity_at), "d 'de' MMM, HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* Contact Edit Dialog */}
      <ContactEditDialog
        contact={contact || null}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSave={handleContactSave}
      />

    </div>
  )
}
