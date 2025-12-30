'use client'

import { useState } from 'react'
import { Plus, Pin, Trash2, AlertCircle, Info, Bell, Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useTeamAnnouncements,
  getCategoryColor,
  getCategoryLabel,
  type AnnouncementCategory,
} from '@/hooks/useTeamAnnouncements'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

export function TeamAnnouncements() {
  const { user } = useAuth()
  const {
    announcements,
    isLoading,
    isAdmin,
    createAnnouncement,
    togglePin,
    deleteAnnouncement,
  } = useTeamAnnouncements()

  const [isCreating, setIsCreating] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState<AnnouncementCategory>('informativo')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!newContent.trim()) return

    setIsSubmitting(true)
    try {
      await createAnnouncement(newContent.trim(), newCategory)
      setNewContent('')
      setNewCategory('informativo')
      setIsCreating(false)
    } catch {
      // Error handled in hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const getCategoryIcon = (category: AnnouncementCategory) => {
    switch (category) {
      case 'urgente':
        return <AlertCircle className="h-4 w-4" />
      case 'lembrete':
        return <Bell className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Agora'
    if (diffMins < 60) return `${diffMins}min`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Avisos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Avisos</CardTitle>
          {!isCreating && (
            <Button size="sm" onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create form */}
        {isCreating && (
          <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
            <Textarea
              placeholder="Digite seu aviso..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
            />
            <div className="flex items-center gap-2">
              <Select
                value={newCategory}
                onValueChange={(v) => setNewCategory(v as AnnouncementCategory)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informativo">Informativo</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                  <SelectItem value="lembrete">Lembrete</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsCreating(false)
                  setNewContent('')
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!newContent.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Publicar'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Announcements list */}
        {announcements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum aviso ainda</p>
            <p className="text-sm">Crie um aviso para a equipe</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => {
              const colors = getCategoryColor(announcement.category)
              const canDelete = announcement.author_id === user?.id || isAdmin

              return (
                <div
                  key={announcement.id}
                  className={cn(
                    'p-3 rounded-lg border',
                    colors.bg,
                    colors.border
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={announcement.author?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {announcement.author?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {announcement.author?.name || 'Usuario'}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn('text-xs gap-1', colors.text)}
                        >
                          {getCategoryIcon(announcement.category)}
                          {getCategoryLabel(announcement.category)}
                        </Badge>
                        {announcement.is_pinned && (
                          <Pin className="h-3 w-3 text-primary" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatTime(announcement.created_at)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
                        {announcement.content}
                      </p>
                    </div>

                    <div className="flex gap-1">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => togglePin(announcement.id)}
                          title={announcement.is_pinned ? 'Desafixar' : 'Fixar'}
                        >
                          <Pin
                            className={cn(
                              'h-3.5 w-3.5',
                              announcement.is_pinned && 'text-primary fill-primary'
                            )}
                          />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteAnnouncement(announcement.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
