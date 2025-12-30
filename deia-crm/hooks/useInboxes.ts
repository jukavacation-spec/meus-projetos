'use client'

import { useEffect, useState, useCallback } from 'react'

export type Inbox = {
  id: number
  name: string
  channel_type: string
  avatar_url: string | null
  phone_number: string | null
}

export type InboxSettings = Record<number, boolean> // inbox_id -> is_active

type UseInboxesOptions = {
  filterByAgent?: boolean // Se true, filtra por permissões do agente (default: true)
}

export function useInboxes(options: UseInboxesOptions = {}) {
  const { filterByAgent = true } = options
  const [inboxes, setInboxes] = useState<Inbox[]>([])
  const [inboxSettings, setInboxSettings] = useState<InboxSettings>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchInboxes = useCallback(async () => {
    try {
      // Fetch inboxes and settings in parallel
      const inboxesUrl = filterByAgent
        ? '/api/chatwoot/inboxes'
        : '/api/chatwoot/inboxes?filterByAgent=false'

      const [inboxesResponse, settingsResponse] = await Promise.all([
        fetch(inboxesUrl),
        fetch('/api/settings/inboxes')
      ])

      const inboxesData = await inboxesResponse.json()
      const settingsData = await settingsResponse.json()

      if (!inboxesResponse.ok) {
        throw new Error(inboxesData.error || 'Failed to fetch inboxes')
      }

      setInboxes(inboxesData.inboxes || [])
      setInboxSettings(settingsData.settings || {})
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [filterByAgent])

  useEffect(() => {
    fetchInboxes()
  }, [fetchInboxes])

  // Helper: check if inbox is active (default to true if not configured)
  const isInboxActive = useCallback((inboxId: number) => {
    // Se não há configuração para esta inbox, considerar ativa por padrão
    if (!(inboxId in inboxSettings)) {
      return true
    }
    return inboxSettings[inboxId]
  }, [inboxSettings])

  // Get only active inboxes
  const activeInboxes = inboxes.filter(inbox => isInboxActive(inbox.id))

  // Get list of active inbox IDs
  const activeInboxIds = activeInboxes.map(inbox => inbox.id)

  return {
    inboxes,
    activeInboxes,
    activeInboxIds,
    inboxSettings,
    isInboxActive,
    isLoading,
    error,
    refetch: fetchInboxes
  }
}

// Helper function to get channel icon name based on channel_type
export function getChannelIcon(channelType: string): string {
  const channelIcons: Record<string, string> = {
    'Channel::WebWidget': 'globe',
    'Channel::Api': 'code',
    'Channel::Email': 'mail',
    'Channel::FacebookPage': 'facebook',
    'Channel::TwitterProfile': 'twitter',
    'Channel::TwilioSms': 'message-square',
    'Channel::Whatsapp': 'message-circle',
    'Channel::Telegram': 'send',
    'Channel::Line': 'message-square',
    'Channel::Sms': 'smartphone',
  }
  return channelIcons[channelType] || 'message-square'
}

// Helper function to get channel display name
export function getChannelName(channelType: string): string {
  const channelNames: Record<string, string> = {
    'Channel::WebWidget': 'Website',
    'Channel::Api': 'API',
    'Channel::Email': 'Email',
    'Channel::FacebookPage': 'Facebook',
    'Channel::TwitterProfile': 'Twitter',
    'Channel::TwilioSms': 'SMS (Twilio)',
    'Channel::Whatsapp': 'WhatsApp',
    'Channel::Telegram': 'Telegram',
    'Channel::Line': 'Line',
    'Channel::Sms': 'SMS',
  }
  return channelNames[channelType] || channelType.replace('Channel::', '')
}
