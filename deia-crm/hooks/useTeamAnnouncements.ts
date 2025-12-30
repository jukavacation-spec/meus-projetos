'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export type AnnouncementCategory = 'urgente' | 'informativo' | 'lembrete'

export type TeamAnnouncement = {
  id: string
  company_id: string
  author_id: string
  content: string
  category: AnnouncementCategory
  is_pinned: boolean
  created_at: string
  updated_at: string
  author?: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  }
}

export function useTeamAnnouncements() {
  const { user, company, hasPermission } = useAuth()
  const [announcements, setAnnouncements] = useState<TeamAnnouncement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const isAdmin = hasPermission('settings', 'read')

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    if (!company) return

    const supabase = createClient()

    try {
      const { data, error: fetchError } = await supabase
        .from('team_announcements')
        .select(`
          *,
          author:users!author_id(id, name, email, avatar_url)
        `)
        .eq('company_id', company.id)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)

      if (fetchError) throw fetchError

      setAnnouncements(data || [])
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [company])

  // Create announcement
  const createAnnouncement = useCallback(async (
    content: string,
    category: AnnouncementCategory = 'informativo'
  ) => {
    if (!user || !company) return null

    const supabase = createClient()

    try {
      const { data, error: insertError } = await supabase
        .from('team_announcements')
        .insert({
          company_id: company.id,
          author_id: user.id,
          content,
          category,
        })
        .select(`
          *,
          author:users!author_id(id, name, email, avatar_url)
        `)
        .single()

      if (insertError) throw insertError

      // Add to beginning of list (or after pinned items)
      setAnnouncements(prev => {
        const pinned = prev.filter(a => a.is_pinned)
        const unpinned = prev.filter(a => !a.is_pinned)
        return [...pinned, data, ...unpinned]
      })

      return data
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }, [user, company])

  // Toggle pin status (admin only)
  const togglePin = useCallback(async (announcementId: string) => {
    if (!isAdmin) return

    const supabase = createClient()

    try {
      const announcement = announcements.find(a => a.id === announcementId)
      if (!announcement) return

      const newPinnedStatus = !announcement.is_pinned

      const { error: updateError } = await supabase
        .from('team_announcements')
        .update({ is_pinned: newPinnedStatus })
        .eq('id', announcementId)

      if (updateError) throw updateError

      // Re-sort announcements
      setAnnouncements(prev => {
        const updated = prev.map(a =>
          a.id === announcementId ? { ...a, is_pinned: newPinnedStatus } : a
        )
        const pinned = updated.filter(a => a.is_pinned)
        const unpinned = updated.filter(a => !a.is_pinned)
        return [
          ...pinned.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
          ...unpinned.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        ]
      })
    } catch (err) {
      setError(err as Error)
    }
  }, [isAdmin, announcements])

  // Delete announcement
  const deleteAnnouncement = useCallback(async (announcementId: string) => {
    if (!user) return

    const supabase = createClient()

    try {
      const { error: deleteError } = await supabase
        .from('team_announcements')
        .delete()
        .eq('id', announcementId)

      if (deleteError) throw deleteError

      setAnnouncements(prev => prev.filter(a => a.id !== announcementId))
    } catch (err) {
      setError(err as Error)
    }
  }, [user])

  // Setup realtime subscription
  useEffect(() => {
    if (!company) return

    fetchAnnouncements()

    const supabase = createClient()

    const channel = supabase
      .channel(`announcements-${company.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_announcements',
          filter: `company_id=eq.${company.id}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Fetch with author data
            const { data } = await supabase
              .from('team_announcements')
              .select(`
                *,
                author:users!author_id(id, name, email, avatar_url)
              `)
              .eq('id', (payload.new as TeamAnnouncement).id)
              .single()

            if (data) {
              setAnnouncements(prev => {
                // Avoid duplicates
                if (prev.some(a => a.id === data.id)) return prev
                const pinned = prev.filter(a => a.is_pinned)
                const unpinned = prev.filter(a => !a.is_pinned)
                if (data.is_pinned) {
                  return [data, ...pinned, ...unpinned]
                }
                return [...pinned, data, ...unpinned]
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as TeamAnnouncement
            setAnnouncements(prev => {
              const newList = prev.map(a =>
                a.id === updated.id ? { ...a, ...updated } : a
              )
              const pinned = newList.filter(a => a.is_pinned)
              const unpinned = newList.filter(a => !a.is_pinned)
              return [...pinned, ...unpinned]
            })
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as TeamAnnouncement
            setAnnouncements(prev => prev.filter(a => a.id !== deleted.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [company, fetchAnnouncements])

  return {
    announcements,
    isLoading,
    error,
    isAdmin,
    createAnnouncement,
    togglePin,
    deleteAnnouncement,
    refetch: fetchAnnouncements,
  }
}

// Get category color
export function getCategoryColor(category: AnnouncementCategory): {
  bg: string
  text: string
  border: string
} {
  switch (category) {
    case 'urgente':
      return {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-300 dark:border-red-700',
      }
    case 'lembrete':
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-300',
        border: 'border-yellow-300 dark:border-yellow-700',
      }
    case 'informativo':
    default:
      return {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-300 dark:border-blue-700',
      }
  }
}

// Get category label
export function getCategoryLabel(category: AnnouncementCategory): string {
  switch (category) {
    case 'urgente':
      return 'Urgente'
    case 'lembrete':
      return 'Lembrete'
    case 'informativo':
    default:
      return 'Informativo'
  }
}
