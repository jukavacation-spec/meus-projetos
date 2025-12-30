import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatPhone } from '@/lib/utils/phone'

type Contact = {
  id: string
  phone: string
  name: string | null
  avatar_url: string | null
}

type Conversation = {
  id: string
  contact_id: string
  stage_id: string | null
  priority: string
  subject: string | null
  last_activity_at: string
  contact?: Contact
}

interface KanbanCardProps {
  conversation: Conversation
  isDragging?: boolean
  onClick?: (contactId: string) => void
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

export function KanbanCard({ conversation, isDragging, onClick }: KanbanCardProps) {
  const contact = conversation.contact

  const handleClick = () => {
    if (onClick && contact?.id) {
      onClick(contact.id)
    }
  }

  return (
    <Card
      onClick={handleClick}
      className={cn(
        'mb-2 cursor-grab active:cursor-grabbing hover:shadow-md select-none',
        isDragging && 'shadow-xl rotate-1 ring-2 ring-primary/50 opacity-95'
      )}
    >
      <CardContent className="p-3">
        {/* Contact info */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={contact?.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {contact?.name?.charAt(0)?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {contact?.name || 'Sem nome'}
            </p>
            <p className="text-xs text-muted-foreground">
              {contact?.phone ? formatPhone(contact.phone) : 'Sem telefone'}
            </p>
          </div>
        </div>

        {/* Subject */}
        {conversation.subject && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {conversation.subject}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(conversation.last_activity_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </div>

          <Badge className={cn('text-xs', priorityColors[conversation.priority] || priorityColors.normal)}>
            {conversation.priority}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
