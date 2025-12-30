'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export type QuickReply = {
  id: string
  company_id: string
  title: string
  shortcut: string
  content: string
  category: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
}

export type QuickReplyInput = {
  shortcut: string
  title: string
  content: string
  category?: string | null
  is_active?: boolean
}

export function useQuickReplies(options: { activeOnly?: boolean } = {}) {
  const { activeOnly = false } = options
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchQuickReplies = useCallback(async () => {
    const supabase = createClient()
    try {
      let query = supabase
        .from('quick_replies')
        .select('*')
        .order('category', { ascending: true, nullsFirst: false })
        .order('shortcut', { ascending: true })

      if (activeOnly) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query

      if (error) throw error
      setQuickReplies((data || []) as QuickReply[])
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [activeOnly])

  useEffect(() => {
    fetchQuickReplies()
  }, [fetchQuickReplies])

  const createQuickReply = useCallback(async (input: QuickReplyInput) => {
    const supabase = createClient()

    // Get current user's info
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuario nao autenticado')

    const { data: profile } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) throw new Error('Empresa nao encontrada')

    const { data: newReply, error } = await supabase
      .from('quick_replies')
      .insert({
        company_id: profile.company_id,
        shortcut: input.shortcut.toLowerCase().replace(/\s+/g, '_'),
        title: input.title,
        content: input.content,
        category: input.category || null,
        is_active: input.is_active ?? true,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error
    setQuickReplies(prev => [...prev, newReply as QuickReply])
    return newReply
  }, [])

  const updateQuickReply = useCallback(async (id: string, input: Partial<QuickReplyInput>) => {
    const supabase = createClient()

    const updateData: Record<string, unknown> = {}
    if (input.shortcut !== undefined) {
      updateData.shortcut = input.shortcut.toLowerCase().replace(/\s+/g, '_')
    }
    if (input.title !== undefined) updateData.title = input.title
    if (input.content !== undefined) updateData.content = input.content
    if (input.category !== undefined) updateData.category = input.category || null
    if (input.is_active !== undefined) updateData.is_active = input.is_active

    const { data, error } = await supabase
      .from('quick_replies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    setQuickReplies(prev => prev.map(qr => qr.id === id ? (data as QuickReply) : qr))
    return data
  }, [])

  const deleteQuickReply = useCallback(async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('quick_replies')
      .delete()
      .eq('id', id)

    if (error) throw error
    setQuickReplies(prev => prev.filter(qr => qr.id !== id))
  }, [])

  const toggleActive = useCallback(async (id: string) => {
    const quickReply = quickReplies.find(qr => qr.id === id)
    if (!quickReply) return

    return updateQuickReply(id, { is_active: !quickReply.is_active })
  }, [quickReplies, updateQuickReply])

  const duplicateQuickReply = useCallback(async (id: string) => {
    const quickReply = quickReplies.find(qr => qr.id === id)
    if (!quickReply) return

    return createQuickReply({
      shortcut: `${quickReply.shortcut}_copia`,
      title: `${quickReply.title} (copia)`,
      content: quickReply.content,
      category: quickReply.category,
      is_active: false,
    })
  }, [quickReplies, createQuickReply])

  // Buscar por shortcut (ex: /saudacao)
  const findByShortcut = useCallback((shortcut: string) => {
    return quickReplies.find(qr =>
      qr.is_active && qr.shortcut.toLowerCase() === shortcut.toLowerCase()
    )
  }, [quickReplies])

  // Filtrar por termo de busca
  const search = useCallback((term: string) => {
    const lowerTerm = term.toLowerCase()
    return quickReplies.filter(qr =>
      qr.title.toLowerCase().includes(lowerTerm) ||
      qr.content.toLowerCase().includes(lowerTerm) ||
      qr.shortcut.toLowerCase().includes(lowerTerm)
    )
  }, [quickReplies])

  // Agrupar por categoria
  const groupedByCategory = useCallback(() => {
    return quickReplies.reduce((acc, qr) => {
      const category = qr.category || 'Geral'
      if (!acc[category]) acc[category] = []
      acc[category].push(qr)
      return acc
    }, {} as Record<string, QuickReply[]>)
  }, [quickReplies])

  // Get unique categories
  const categories = Array.from(
    new Set(quickReplies.map(qr => qr.category).filter(Boolean))
  ) as string[]

  return {
    quickReplies,
    categories,
    isLoading,
    error,
    refetch: fetchQuickReplies,
    createQuickReply,
    updateQuickReply,
    deleteQuickReply,
    toggleActive,
    duplicateQuickReply,
    findByShortcut,
    search,
    groupedByCategory
  }
}
