'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  User,
  MessageCircle,
  FileText,
  Search,
  Loader2,
} from 'lucide-react'
import { useGlobalSearch, type SearchResultType } from '@/hooks/useGlobalSearch'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'

const typeIcons: Record<SearchResultType, typeof User> = {
  contact: User,
  conversation: MessageCircle,
  message: FileText,
}

const typeLabels: Record<SearchResultType, string> = {
  contact: 'Contatos',
  conversation: 'Conversas',
  message: 'Mensagens',
}

interface GlobalSearchProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function GlobalSearch({ open: controlledOpen, onOpenChange }: GlobalSearchProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const router = useRouter()
  const { results, isSearching, search, clearSearch } = useGlobalSearch()

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  // Debounce search input
  const debouncedSearch = useDebounce(inputValue, 300)

  useEffect(() => {
    if (debouncedSearch) {
      search(debouncedSearch)
    } else {
      clearSearch()
    }
  }, [debouncedSearch, search, clearSearch])

  // Keyboard shortcut Ctrl+K or Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, setOpen])

  const handleSelect = useCallback((url: string) => {
    setOpen(false)
    setInputValue('')
    clearSearch()
    router.push(url)
  }, [router, setOpen, clearSearch])

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setInputValue('')
      clearSearch()
    }
  }, [setOpen, clearSearch])

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = []
    }
    acc[result.type].push(result)
    return acc
  }, {} as Record<SearchResultType, typeof results>)

  const resultTypes = Object.keys(groupedResults) as SearchResultType[]

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder="Buscar contatos, conversas, mensagens..."
        value={inputValue}
        onValueChange={setInputValue}
      />
      <CommandList>
        {isSearching ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : inputValue && results.length === 0 ? (
          <CommandEmpty>
            <div className="flex flex-col items-center py-6">
              <Search className="h-10 w-10 text-muted-foreground mb-2" />
              <p>Nenhum resultado encontrado</p>
              <p className="text-sm text-muted-foreground">
                Tente buscar por outro termo
              </p>
            </div>
          </CommandEmpty>
        ) : !inputValue ? (
          <CommandEmpty>
            <div className="flex flex-col items-center py-6">
              <Search className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                Digite para buscar...
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Dica: Use <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+K</kbd> para abrir a busca
              </p>
            </div>
          </CommandEmpty>
        ) : (
          resultTypes.map((type, index) => {
            const Icon = typeIcons[type]
            const items = groupedResults[type]

            return (
              <div key={type}>
                {index > 0 && <CommandSeparator />}
                <CommandGroup heading={typeLabels[type]}>
                  {items.map((item) => (
                    <CommandItem
                      key={`${item.type}-${item.id}`}
                      value={`${item.type}-${item.id}-${item.title}`}
                      onSelect={() => handleSelect(item.url)}
                      className="cursor-pointer"
                    >
                      <Icon className="mr-2 h-4 w-4 shrink-0" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="truncate font-medium">{item.title}</span>
                        {item.subtitle && (
                          <span className="text-xs text-muted-foreground truncate">
                            {item.subtitle}
                          </span>
                        )}
                        {item.highlight && (
                          <span className="text-xs text-muted-foreground truncate mt-0.5 italic">
                            &quot;{item.highlight}&quot;
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            )
          })
        )}
      </CommandList>
    </CommandDialog>
  )
}

// Botao de atalho para o Header
export function GlobalSearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2 w-64 h-9 px-3",
        "text-sm text-muted-foreground",
        "bg-muted/50 border rounded-md",
        "hover:bg-muted transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-ring"
      )}
    >
      <Search className="h-4 w-4" />
      <span>Buscar...</span>
      <kbd className="ml-auto pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
        <span className="text-xs">Ctrl</span>K
      </kbd>
    </button>
  )
}
