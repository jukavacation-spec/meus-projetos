'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { memo, useMemo, useState, useEffect } from 'react'
import {
  LayoutDashboard,
  MessageSquare,
  Kanban,
  Users,
  Settings,
  UserCircle,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Zap,
  ChevronUp,
  Check,
  Circle,
  Clock,
  UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAuth, useSignOut } from '@/hooks/useAuth'
import { useTeamMessages } from '@/hooks/useTeamMessages'
import { useTeamPresence, type PresenceStatus } from '@/hooks/useTeamPresence'
import { useAssignedConversations } from '@/hooks/useAssignedConversations'
import { UserSettingsModal } from '@/components/user/UserSettingsModal'

const STATUS_OPTIONS: { value: PresenceStatus; label: string; color: string }[] = [
  { value: 'online', label: 'Online', color: 'bg-green-500' },
  { value: 'busy', label: 'Ocupado', color: 'bg-yellow-500' },
  { value: 'offline', label: 'Offline', color: 'bg-gray-400' },
]

const INACTIVITY_STATUS_KEY = 'inactivity_status_preference'
const AUTO_AWAY_ENABLED_KEY = 'auto_away_enabled'

type InactivityStatus = 'busy' | 'offline'

type NavItem = {
  name: string
  href: string
  icon: typeof LayoutDashboard
  permission?: { resource: string; action: string }
  badgeKey?: 'teamMessages' | 'assignedConversations'
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Inbox', href: '/inbox', icon: MessageSquare },
  { name: 'Atribuidas', href: '/assigned', icon: UserCheck, badgeKey: 'assignedConversations' },
  { name: 'Kanban', href: '/kanban', icon: Kanban, permission: { resource: 'kanban', action: 'read' } },
  { name: 'Contatos', href: '/contacts', icon: Users, permission: { resource: 'contacts', action: 'read' } },
  { name: 'Respostas', href: '/automations', icon: Zap }, // Todos podem ver - aba de automacoes escondida para agents
  { name: 'Equipe', href: '/team', icon: UserCircle, permission: { resource: 'team', action: 'read' }, badgeKey: 'teamMessages' },
  { name: 'Configuracoes', href: '/settings', icon: Settings, permission: { resource: 'settings', action: 'read' } },
]

type SidebarProps = {
  collapsed?: boolean
  onToggle?: () => void
}

function SidebarComponent({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { profile, company, hasPermission } = useAuth()
  const signOut = useSignOut()
  const { totalUnread: teamMessagesUnread } = useTeamMessages()
  const { totalCount: assignedConversationsCount } = useAssignedConversations()
  const { myPresence, updateMyPresence, goOffline, getStatusColor, getStatusLabel, setInactivityStatus, setAutoAwayEnabled } = useTeamPresence()
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [inactivityPreference, setInactivityPreference] = useState<InactivityStatus>('busy')
  const [autoAwayEnabled, setAutoAwayEnabledState] = useState(true)

  // Carregar preferencias do localStorage
  useEffect(() => {
    // Status de inatividade
    const storedStatus = localStorage.getItem(INACTIVITY_STATUS_KEY)
    if (storedStatus === 'busy' || storedStatus === 'offline') {
      setInactivityPreference(storedStatus)
      setInactivityStatus(storedStatus)
    }

    // Auto-away habilitado
    const storedEnabled = localStorage.getItem(AUTO_AWAY_ENABLED_KEY)
    const enabled = storedEnabled !== 'false' // Default true
    setAutoAwayEnabledState(enabled)
    setAutoAwayEnabled(enabled)
  }, [setInactivityStatus, setAutoAwayEnabled])

  // Status atual
  const currentStatus = myPresence?.status || 'online'
  const statusColor = getStatusColor(currentStatus)

  // Mapa de badges
  const badges: Record<string, number> = {
    teamMessages: teamMessagesUnread,
    assignedConversations: assignedConversationsCount,
  }

  // Logout melhorado (seta offline antes)
  const handleLogout = async () => {
    await goOffline()
    signOut()
  }

  // Mudar status
  const handleStatusChange = async (status: PresenceStatus) => {
    await updateMyPresence(status)
  }

  // Mudar preferencia de inatividade
  const handleInactivityPreferenceChange = (status: InactivityStatus) => {
    setInactivityPreference(status)
    localStorage.setItem(INACTIVITY_STATUS_KEY, status)
    setInactivityStatus(status)
  }

  // Toggle auto-away
  const handleAutoAwayToggle = (enabled: boolean) => {
    setAutoAwayEnabledState(enabled)
    localStorage.setItem(AUTO_AWAY_ENABLED_KEY, String(enabled))
    setAutoAwayEnabled(enabled)
  }

  // Memoizar dados derivados
  const userInitial = useMemo(() =>
    profile?.name?.charAt(0)?.toUpperCase() || 'U',
    [profile?.name]
  )

  const userName = useMemo(() =>
    profile?.name || 'Usuario',
    [profile?.name]
  )

  // Filtrar navegacao baseado nas permissoes
  const filteredNavigation = useMemo(() =>
    navigation.filter(item => {
      // Se nao tem permissao definida, sempre mostra
      if (!item.permission) return true
      // Verifica se tem permissao
      return hasPermission(item.permission.resource, item.permission.action)
    }),
    [hasPermission]
  )

  // Verificar se pode ver configuracoes (para esconder no menu do usuario)
  const canAccessSettings = hasPermission('settings', 'read')

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <div className="flex h-full w-16 flex-col border-r bg-card shrink-0">
          {/* Logo */}
          <div className="flex h-16 items-center justify-center border-b">
            <Link href="/">
              <img
                src="/logo-icon.png"
                alt="FalDesk"
                className="h-12 w-12 object-contain dark:invert"
              />
            </Link>
          </div>

          {/* Toggle button */}
          {onToggle && (
            <div className="flex justify-center py-2 border-b">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8">
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Expandir menu</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 flex flex-col items-center gap-1 py-4">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href))
              const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0

              return (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {badgeCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </Badge>
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </nav>

          {/* User menu */}
          <div className="border-t p-2 flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 relative">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback>
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <span className={cn(
                    "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card",
                    statusColor
                  )} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" side="right" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email}</p>
                </div>

                <DropdownMenuSeparator />

                {/* Status submenu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Circle className={cn("mr-2 h-3 w-3 fill-current", statusColor.replace('bg-', 'text-'))} />
                    {getStatusLabel(currentStatus)}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      {STATUS_OPTIONS.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => handleStatusChange(option.value)}
                          className="gap-2"
                        >
                          <Circle className={cn("h-3 w-3 fill-current", option.color.replace('bg-', 'text-'))} />
                          <span className="flex-1">{option.label}</span>
                          {currentStatus === option.value && (
                            <Check className="h-4 w-4" />
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <label htmlFor="auto-away-collapsed" className="text-xs text-muted-foreground cursor-pointer">
                            Marcar inativo automaticamente
                          </label>
                          <Switch
                            id="auto-away-collapsed"
                            checked={autoAwayEnabled}
                            onCheckedChange={handleAutoAwayToggle}
                            className="scale-75"
                          />
                        </div>
                        {autoAwayEnabled && (
                          <>
                            <p className="text-xs text-muted-foreground">Quando inativo, ficar:</p>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant={inactivityPreference === 'busy' ? 'default' : 'outline'}
                                className="flex-1 h-7 text-xs"
                                onClick={() => handleInactivityPreferenceChange('busy')}
                              >
                                <Circle className="h-2 w-2 fill-current text-red-500 mr-1" />
                                Ocupado
                              </Button>
                              <Button
                                size="sm"
                                variant={inactivityPreference === 'offline' ? 'default' : 'outline'}
                                className="flex-1 h-7 text-xs"
                                onClick={() => handleInactivityPreferenceChange('offline')}
                              >
                                <Circle className="h-2 w-2 fill-current text-gray-400 mr-1" />
                                Offline
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                {/* Configuracoes do Perfil */}
                <DropdownMenuItem onClick={() => setShowSettingsModal(true)}>
                  <UserCircle className="mr-2 h-4 w-4" />
                  Configuracoes do Perfil
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Modal de Configuracoes */}
          <UserSettingsModal
            open={showSettingsModal}
            onOpenChange={setShowSettingsModal}
          />
        </div>
      </TooltipProvider>
    )
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card shrink-0">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        <Link href="/" className="flex items-center gap-2">
          <img
            src="/logo-icon.png"
            alt="FalDesk"
            className="h-16 w-16 object-contain dark:invert"
          />
          <span className="text-xl font-semibold">FalDesk</span>
        </Link>
        {onToggle && (
          <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Company */}
      {company && (
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium truncate">{company.name}</p>
          <p className="text-xs text-muted-foreground">Plano {company.plan}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{item.name}</span>
              {badgeCount > 0 && (
                <Badge className="h-5 min-w-[20px] px-1.5 text-xs">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User menu */}
      <div className="border-t p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 px-3">
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback>
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <span className={cn(
                  "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card",
                  statusColor
                )} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">
                  {userName}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Circle className={cn("h-2 w-2 fill-current", statusColor.replace('bg-', 'text-'))} />
                  <span>{getStatusLabel(currentStatus)}</span>
                </div>
              </div>
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </div>

            <DropdownMenuSeparator />

            {/* Status submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Circle className={cn("mr-2 h-3 w-3 fill-current", statusColor.replace('bg-', 'text-'))} />
                {getStatusLabel(currentStatus)}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {STATUS_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => handleStatusChange(option.value)}
                      className="gap-2"
                    >
                      <Circle className={cn("h-3 w-3 fill-current", option.color.replace('bg-', 'text-'))} />
                      <span className="flex-1">{option.label}</span>
                      {currentStatus === option.value && (
                        <Check className="h-4 w-4" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="auto-away-expanded" className="text-xs text-muted-foreground cursor-pointer">
                        Marcar inativo automaticamente
                      </label>
                      <Switch
                        id="auto-away-expanded"
                        checked={autoAwayEnabled}
                        onCheckedChange={handleAutoAwayToggle}
                        className="scale-75"
                      />
                    </div>
                    {autoAwayEnabled && (
                      <>
                        <p className="text-xs text-muted-foreground">Quando inativo, ficar:</p>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={inactivityPreference === 'busy' ? 'default' : 'outline'}
                            className="flex-1 h-7 text-xs"
                            onClick={() => handleInactivityPreferenceChange('busy')}
                          >
                            <Circle className="h-2 w-2 fill-current text-red-500 mr-1" />
                            Ocupado
                          </Button>
                          <Button
                            size="sm"
                            variant={inactivityPreference === 'offline' ? 'default' : 'outline'}
                            className="flex-1 h-7 text-xs"
                            onClick={() => handleInactivityPreferenceChange('offline')}
                          >
                            <Circle className="h-2 w-2 fill-current text-gray-400 mr-1" />
                            Offline
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            {/* Configuracoes do Perfil */}
            <DropdownMenuItem onClick={() => setShowSettingsModal(true)}>
              <UserCircle className="mr-2 h-4 w-4" />
              Configuracoes do Perfil
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Modal de Configuracoes */}
      <UserSettingsModal
        open={showSettingsModal}
        onOpenChange={setShowSettingsModal}
      />
    </div>
  )
}

// Exportar com memo para evitar re-renders desnecessários
export const Sidebar = memo(SidebarComponent)
