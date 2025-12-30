'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'

export type SearchResultType = 'contact' | 'conversation' | 'message'

export type SearchResult = {
  id: string
  type: SearchResultType
  title: string
  subtitle?: string
  highlight?: string
  url: string
  data?: Record<string, unknown>
}

export function useGlobalSearch() {
  const { profile } = useAuth()
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [query, setQuery] = useState('')

  const search = useCallback(async (searchQuery: string) => {
    if (!profile?.company_id || !searchQuery.trim()) {
      setResults([])
      return
    }

    setQuery(searchQuery)
    setIsSearching(true)

    const supabase = createClient()
    const term = searchQuery.trim().toLowerCase()
    const allResults: SearchResult[] = []

    try {
      // Buscar contatos
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, email, phone, phone_normalized')
        .eq('company_id', profile.company_id)
        .or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,phone_normalized.ilike.%${term}%`)
        .limit(5)

      if (contacts) {
        for (const contact of contacts) {
          const subtitle = contact.email || contact.phone
          allResults.push({
            id: contact.id,
            type: 'contact',
            title: contact.name || 'Sem nome',
            subtitle,
            url: `/contacts?id=${contact.id}`,
            data: contact,
          })
        }
      }

      // Buscar conversas (primeiro buscar IDs de contatos que correspondem)
      const { data: matchingContacts } = await supabase
        .from('contacts')
        .select('id')
        .eq('company_id', profile.company_id)
        .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
        .limit(10)

      if (matchingContacts && matchingContacts.length > 0) {
        const contactIds = matchingContacts.map(c => c.id)

        const { data: conversations } = await supabase
          .from('conversations')
          .select(`
            id,
            chatwoot_conversation_id,
            status,
            last_activity_at,
            contact:contacts(id, name, phone)
          `)
          .eq('company_id', profile.company_id)
          .in('contact_id', contactIds)
          .order('last_activity_at', { ascending: false })
          .limit(5)

        if (conversations) {
          for (const conv of conversations) {
            const contactData = conv.contact as unknown as { id: string; name: string; phone: string }
            allResults.push({
              id: conv.id,
              type: 'conversation',
              title: contactData?.name || 'Conversa',
              subtitle: contactData?.phone || `#${conv.chatwoot_conversation_id}`,
              url: `/inbox?conversation=${conv.id}`,
              data: conv,
            })
          }
        }
      }

      // Buscar mensagens (primeiro buscar IDs de conversas da empresa)
      const { data: companyConversations } = await supabase
        .from('conversations')
        .select('id, contact:contacts(name)')
        .eq('company_id', profile.company_id)
        .order('last_activity_at', { ascending: false })
        .limit(100)

      if (companyConversations && companyConversations.length > 0) {
        const conversationIds = companyConversations.map(c => c.id)
        const conversationMap = new Map(
          companyConversations.map(c => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const contact = c.contact as any
            const contactName = contact?.name || 'Desconhecido'
            return [c.id, contactName as string]
          })
        )

        const { data: messages } = await supabase
          .from('messages')
          .select('id, content, created_at, conversation_id')
          .in('conversation_id', conversationIds)
          .ilike('content', `%${term}%`)
          .order('created_at', { ascending: false })
          .limit(5)

        if (messages) {
          for (const msg of messages) {
            const contactName = conversationMap.get(msg.conversation_id) || 'Desconhecido'

            // Extrair trecho da mensagem com o termo destacado
            const content = msg.content || ''
            const termIndex = content.toLowerCase().indexOf(term)
            let highlight = content
            if (termIndex >= 0 && content.length > 60) {
              const start = Math.max(0, termIndex - 20)
              const end = Math.min(content.length, termIndex + term.length + 40)
              highlight = (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '')
            }

            allResults.push({
              id: msg.id,
              type: 'message',
              title: `Mensagem de ${contactName}`,
              subtitle: new Date(msg.created_at).toLocaleDateString('pt-BR'),
              highlight,
              url: `/inbox?conversation=${msg.conversation_id}&message=${msg.id}`,
              data: msg,
            })
          }
        }
      }

      setResults(allResults)
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [profile?.company_id])

  const clearSearch = useCallback(() => {
    setQuery('')
    setResults([])
  }, [])

  return {
    query,
    results,
    isSearching,
    search,
    clearSearch,
  }
}
