'use client'

import { useState } from 'react'
import { useTeam, type TeamMember, type TeamInvite } from '@/hooks/useTeam'
import { useAuth } from '@/hooks/useAuth'
import { useInboxes, getChannelName } from '@/hooks/useInboxes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Users,
  UserPlus,
  MoreVertical,
  Mail,
  Clock,
  Shield,
  Loader2,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Crown,
  AlertTriangle,
  Inbox,
  MessageCircle,
  Copy,
  Link,
} from 'lucide-react'

const ROLE_ICONS: Record<string, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  supervisor: Users,
  agent: Users,
  viewer: Users,
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500',
  admin: 'bg-purple-500',
  supervisor: 'bg-blue-500',
  agent: 'bg-green-500',
  viewer: 'bg-gray-500',
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }
  return email.slice(0, 2).toUpperCase()
}

export function TeamSettings() {
  const { user } = useAuth()
  const {
    members,
    invites,
    roles,
    isLoading,
    inviteMember,
    cancelInvite,
    resendInvite,
    toggleMemberActive,
    removeMember,
    refetch,
  } = useTeam()
  // Nas configurações, admin precisa ver TODAS as inboxes (sem filtro de agente)
  const { activeInboxes, isLoading: inboxesLoading } = useInboxes({ filterByAgent: false })

  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState('')
  const [inviteInboxIds, setInviteInboxIds] = useState<number[]>([])
  const [isInviting, setIsInviting] = useState(false)
  const [inviteLinkUrl, setInviteLinkUrl] = useState<string | null>(null)
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)

  // Estado para configuração de inboxes do agente
  const [isInboxConfigOpen, setIsInboxConfigOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [memberInboxIds, setMemberInboxIds] = useState<number[]>([])
  const [isLoadingMemberInboxes, setIsLoadingMemberInboxes] = useState(false)
  const [isSavingMemberInboxes, setIsSavingMemberInboxes] = useState(false)

  // Roles disponiveis para convite (sem owner)
  const availableRoles = roles.filter(r => r.name !== 'owner')

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Digite um email')
      return
    }
    if (!inviteRoleId) {
      toast.error('Selecione um cargo')
      return
    }

    setIsInviting(true)
    const result = await inviteMember(inviteEmail, inviteRoleId, inviteInboxIds)
    setIsInviting(false)

    if (result.success) {
      setInviteEmail('')
      setInviteRoleId('')
      setInviteInboxIds([])
      setIsInviteOpen(false)

      // Mostrar dialog com o link do convite
      if (result.inviteUrl) {
        setInviteLinkUrl(result.inviteUrl)
        setIsLinkDialogOpen(true)
      } else {
        toast.success('Convite criado com sucesso!')
      }
    } else {
      toast.error(result.error || 'Erro ao enviar convite')
    }
  }

  const copyInviteLink = () => {
    if (inviteLinkUrl) {
      navigator.clipboard.writeText(inviteLinkUrl)
      toast.success('Link copiado!')
    }
  }

  const toggleInboxSelection = (inboxId: number) => {
    setInviteInboxIds(prev =>
      prev.includes(inboxId)
        ? prev.filter(id => id !== inboxId)
        : [...prev, inboxId]
    )
  }

  const handleCancelInvite = async (invite: TeamInvite) => {
    const result = await cancelInvite(invite.id)
    if (result.success) {
      toast.success('Convite cancelado')
    } else {
      toast.error('Erro ao cancelar convite')
    }
  }

  const handleResendInvite = async (invite: TeamInvite) => {
    const result = await resendInvite(invite.id)
    if (result.success) {
      toast.success('Convite reenviado!')
    } else {
      toast.error('Erro ao reenviar convite')
    }
  }

  // Abrir dialog de configuração de inboxes do membro
  const openInboxConfig = async (member: TeamMember) => {
    setSelectedMember(member)
    setIsInboxConfigOpen(true)
    setIsLoadingMemberInboxes(true)
    setMemberInboxIds([])

    try {
      const response = await fetch(`/api/team/agents/${member.id}/inboxes`)
      const data = await response.json()
      if (data.success) {
        setMemberInboxIds(data.inboxIds || [])
      }
    } catch (error) {
      console.error('Error fetching member inboxes:', error)
      toast.error('Erro ao carregar inboxes do agente')
    } finally {
      setIsLoadingMemberInboxes(false)
    }
  }

  // Salvar inboxes do membro
  const saveMemberInboxes = async () => {
    if (!selectedMember) return

    setIsSavingMemberInboxes(true)
    try {
      const response = await fetch(`/api/team/agents/${selectedMember.id}/inboxes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inboxIds: memberInboxIds }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Inboxes atualizadas com sucesso!')
        setIsInboxConfigOpen(false)
      } else {
        toast.error(data.error || 'Erro ao atualizar inboxes')
      }
    } catch (error) {
      console.error('Error saving member inboxes:', error)
      toast.error('Erro ao salvar inboxes')
    } finally {
      setIsSavingMemberInboxes(false)
    }
  }

  // Toggle inbox para o membro selecionado
  const toggleMemberInbox = (inboxId: number) => {
    setMemberInboxIds(prev =>
      prev.includes(inboxId)
        ? prev.filter(id => id !== inboxId)
        : [...prev, inboxId]
    )
  }


  const handleToggleActive = async (member: TeamMember) => {
    const result = await toggleMemberActive(member.id, !member.is_active)
    if (result.success) {
      toast.success(member.is_active ? 'Usuario desativado' : 'Usuario ativado')
    } else {
      toast.error('Erro ao atualizar status')
    }
  }

  const handleRemoveMember = async (member: TeamMember) => {
    if (!confirm(`Tem certeza que deseja remover ${member.name || member.email} da equipe?`)) {
      return
    }
    const result = await removeMember(member.id)
    if (result.success) {
      toast.success('Membro removido da equipe')
    } else {
      toast.error('Erro ao remover membro')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Membros da Equipe */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Membros da Equipe
              </CardTitle>
              <CardDescription>
                {members.length} membro{members.length !== 1 ? 's' : ''} na equipe
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refetch}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Convidar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Convidar Membro</DialogTitle>
                    <DialogDescription>
                      Envie um convite por email para adicionar um novo membro a equipe.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="invite-email">Email</Label>
                      <Input
                        id="invite-email"
                        type="email"
                        placeholder="email@exemplo.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-role">Cargo</Label>
                      <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cargo" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={5}>
                          {availableRoles.length === 0 ? (
                            <SelectItem value="__empty" disabled>
                              Nenhum cargo disponivel
                            </SelectItem>
                          ) : (
                            availableRoles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.display_name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Seletor de Inboxes */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Inbox className="h-4 w-4" />
                        Inboxes
                      </Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Selecione as inboxes que este agente podera acessar
                      </p>
                      {inboxesLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-8 w-full" />
                        </div>
                      ) : activeInboxes.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          Nenhuma inbox configurada
                        </p>
                      ) : (
                        <div className="border rounded-md max-h-40 overflow-y-auto">
                          {activeInboxes.map((inbox) => (
                            <div
                              key={inbox.id}
                              className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer"
                              onClick={() => toggleInboxSelection(inbox.id)}
                            >
                              <Checkbox
                                checked={inviteInboxIds.includes(inbox.id)}
                                onCheckedChange={() => toggleInboxSelection(inbox.id)}
                              />
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm truncate">{inbox.name}</span>
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  {getChannelName(inbox.channel_type)}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {inviteInboxIds.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {inviteInboxIds.length} inbox{inviteInboxIds.length !== 1 ? 'es' : ''} selecionada{inviteInboxIds.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleInvite} disabled={isInviting}>
                      {isInviting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      Enviar Convite
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum membro encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => {
                const RoleIcon = ROLE_ICONS[member.role?.name || 'viewer'] || Users
                const isCurrentUser = member.id === user?.id
                const isOwner = member.role?.name === 'owner'

                return (
                  <div
                    key={member.id}
                    className={`flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors ${
                      !member.is_active ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(member.name, member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {member.name || member.email.split('@')[0]}
                          </p>
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs">
                              Voce
                            </Badge>
                          )}
                          {!member.is_active && (
                            <Badge variant="secondary" className="text-xs">
                              Inativo
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                        {member.last_seen_at && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            Visto {formatDistanceToNow(new Date(member.last_seen_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge className={`${ROLE_COLORS[member.role?.name || 'viewer']} text-white`}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {member.role?.display_name || 'Sem cargo'}
                      </Badge>

                      {!isCurrentUser && !isOwner && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => openInboxConfig(member)}
                            >
                              <Inbox className="h-4 w-4 mr-2" />
                              Inboxes
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer">
                              <Shield className="h-4 w-4 mr-2" />
                              Alterar Cargo
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => handleToggleActive(member)}
                            >
                              {member.is_active ? (
                                <>
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Desativar
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Ativar
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer text-red-600"
                              onClick={() => handleRemoveMember(member)}
                            >
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Remover da Equipe
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Convites Pendentes */}
      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Convites Pendentes
            </CardTitle>
            <CardDescription>
              {invites.length} convite{invites.length !== 1 ? 's' : ''} aguardando resposta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invites.map((invite) => {
                const RoleIcon = ROLE_ICONS[invite.role?.name || 'viewer'] || Users
                const isExpired = new Date(invite.expires_at) < new Date()

                return (
                  <div
                    key={invite.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      isExpired ? 'opacity-60 border-red-200' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{invite.email}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>
                            Convidado por {invite.inviter?.name || invite.inviter?.email}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {isExpired ? (
                              <span className="text-red-500">Expirado</span>
                            ) : (
                              <>
                                Expira em {formatDistanceToNow(new Date(invite.expires_at), {
                                  locale: ptBR,
                                })}
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge className={`${ROLE_COLORS[invite.role?.name || 'viewer']} text-white`}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {invite.role?.display_name}
                      </Badge>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => handleResendInvite(invite)}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Reenviar Convite
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer text-red-600"
                            onClick={() => handleCancelInvite(invite)}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar Convite
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cargos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Cargos e Permissoes
          </CardTitle>
          <CardDescription>
            Cargos disponiveis e suas permissoes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {roles.map((role) => {
              const RoleIcon = ROLE_ICONS[role.name] || Users
              const permissions = role.permissions || {}

              return (
                <div
                  key={role.id}
                  className="p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`${ROLE_COLORS[role.name]} text-white`}>
                      <RoleIcon className="h-3 w-3 mr-1" />
                      {role.display_name}
                    </Badge>
                    {role.is_system && (
                      <Badge variant="outline" className="text-xs">
                        Sistema
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {Object.entries(permissions).map(([area, perms]) => {
                      const permList = Object.entries(perms as Record<string, boolean>)
                        .filter(([, v]) => v)
                        .map(([k]) => k)
                      if (permList.length === 0) return null
                      return (
                        <div key={area}>
                          <span className="font-medium capitalize">{area}:</span>{' '}
                          {permList.join(', ')}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dialog do Link do Convite */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="h-5 w-5 text-primary" />
              Convite Criado!
            </DialogTitle>
            <DialogDescription>
              Copie o link abaixo e envie para o convidado (via WhatsApp, email, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={inviteLinkUrl || ''}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyInviteLink}
                title="Copiar link"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              O convidado devera acessar este link para criar sua conta e aceitar o convite.
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsLinkDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Configuração de Inboxes do Agente */}
      <Dialog open={isInboxConfigOpen} onOpenChange={setIsInboxConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Inboxes de {selectedMember?.name || selectedMember?.email?.split('@')[0]}
            </DialogTitle>
            <DialogDescription>
              Selecione quais inboxes este agente terá acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {isLoadingMemberInboxes ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : activeInboxes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma inbox configurada
              </p>
            ) : (
              <div className="border rounded-md max-h-64 overflow-y-auto">
                {activeInboxes.map((inbox) => (
                  <div
                    key={inbox.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                    onClick={() => toggleMemberInbox(inbox.id)}
                  >
                    <Checkbox
                      checked={memberInboxIds.includes(inbox.id)}
                      onCheckedChange={() => toggleMemberInbox(inbox.id)}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate">{inbox.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {getChannelName(inbox.channel_type)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            {memberInboxIds.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {memberInboxIds.length} inbox{memberInboxIds.length !== 1 ? 'es' : ''} selecionada{memberInboxIds.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInboxConfigOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveMemberInboxes} disabled={isSavingMemberInboxes}>
              {isSavingMemberInboxes ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
