'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Contact = {
  id: string
  company_id: string
  phone: string
  phone_normalized: string
  name: string | null
  email: string | null
  avatar_url: string | null
  tags: string[]
  labels: string[]
  source: string
  created_at: string
  updated_at: string
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetchContacts() {
      try {
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        setContacts((data || []) as Contact[])
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchContacts()

    // Realtime subscription
    const channel = supabase
      .channel('contacts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setContacts(prev => [payload.new as Contact, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setContacts(prev =>
              prev.map(c => c.id === payload.new.id ? payload.new as Contact : c)
            )
          } else if (payload.eventType === 'DELETE') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setContacts(prev => prev.filter(c => c.id !== (payload.old as any).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { contacts, isLoading, error }
}

export function useContact(contactId: string) {
  const [contact, setContact] = useState<Contact | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetchContact() {
      try {
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', contactId)
          .single()

        if (error) throw error
        setContact(data as Contact)
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    if (contactId) {
      fetchContact()
    }
  }, [contactId])

  return { contact, isLoading, error }
}
