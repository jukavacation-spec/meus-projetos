'use client'

import { useState, useEffect } from 'react'
import { useQuickReplies, QuickReply } from '@/hooks/useQuickReplies'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Zap, Search, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type QuickRepliesPopoverProps = {
  onSelect: (content: string) => void
  inputValue?: string
  onCreateNew?: () => void
}

export function QuickRepliesPopover({
  onSelect,
  inputValue = '',
  onCreateNew
}: QuickRepliesPopoverProps) {
  const { quickReplies, isLoading, search, groupedByCategory } = useQuickReplies({ activeOnly: true })
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const handleSelect = (reply: QuickReply) => {
    onSelect(reply.content)
    setOpen(false)
    setSearchTerm('')
  }

  // Detectar atalho no input (ex: /saudacao)
  useEffect(() => {
    if (inputValue.startsWith('/') && inputValue.length > 1) {
      const shortcut = inputValue.slice(1).toLowerCase()
      const match = quickReplies.find(qr =>
        qr.shortcut.toLowerCase() === shortcut
      )
      if (match) {
        handleSelect(match)
      }
    }
  }, [inputValue, quickReplies, handleSelect])

  const filteredReplies = searchTerm ? search(searchTerm) : quickReplies
  const grouped = groupedByCategory()
  const categories = Object.keys(grouped)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground shrink-0"
          title="Respostas rápidas"
        >
          <Zap className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="top">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Respostas Rápidas</h4>
            {onCreateNew && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false)
                  onCreateNew()
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nova
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ou digite /"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReplies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {searchTerm ? 'Nenhuma resposta encontrada' : 'Nenhuma resposta cadastrada'}
            </div>
          ) : searchTerm ? (
            // Lista simples quando buscando
            <div className="p-2 space-y-1">
              {filteredReplies.map((reply) => (
                <QuickReplyItem
                  key={reply.id}
                  reply={reply}
                  onSelect={() => handleSelect(reply)}
                />
              ))}
            </div>
          ) : (
            // Lista agrupada por categoria
            <div className="p-2">
              {categories.map((category) => (
                <div key={category} className="mb-3">
                  <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                    {category}
                  </div>
                  <div className="space-y-1">
                    {grouped[category].map((reply) => (
                      <QuickReplyItem
                        key={reply.id}
                        reply={reply}
                        onSelect={() => handleSelect(reply)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t text-xs text-muted-foreground text-center">
          Digite <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">/atalho</kbd> para usar rapidamente
        </div>
      </PopoverContent>
    </Popover>
  )
}

function QuickReplyItem({
  reply,
  onSelect
}: {
  reply: QuickReply
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-2 py-2 rounded-md hover:bg-muted transition-colors",
        "flex flex-col gap-1"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{reply.title}</span>
        {reply.shortcut && (
          <Badge variant="secondary" className="text-[10px] px-1.5">
            /{reply.shortcut}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">
        {reply.content}
      </p>
    </button>
  )
}
