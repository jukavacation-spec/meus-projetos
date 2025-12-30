'use client'

import { useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type ShortcutHandler = () => void

type ShortcutConfig = {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  handler: ShortcutHandler
  description: string
}

export function useKeyboardShortcuts(customShortcuts: ShortcutConfig[] = []) {
  const router = useRouter()

  const allShortcuts = useMemo(() => {
    // Define navigation handlers
    const navigationShortcuts: ShortcutConfig[] = [
      {
        key: 'k',
        ctrl: true,
        handler: () => {
          // Focus search input - will be implemented with a search modal
          const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement
          searchInput?.focus()
        },
        description: 'Abrir busca global'
      },
      {
        key: '1',
        ctrl: true,
        handler: () => router.push('/'),
        description: 'Ir para Dashboard'
      },
      {
        key: '2',
        ctrl: true,
        handler: () => router.push('/inbox'),
        description: 'Ir para Inbox'
      },
      {
        key: '3',
        ctrl: true,
        handler: () => router.push('/kanban'),
        description: 'Ir para Kanban'
      },
      {
        key: '4',
        ctrl: true,
        handler: () => router.push('/contacts'),
        description: 'Ir para Contatos'
      },
      {
        key: '5',
        ctrl: true,
        handler: () => router.push('/automations'),
        description: 'Ir para Automações'
      },
      {
        key: ',',
        ctrl: true,
        handler: () => router.push('/settings'),
        description: 'Ir para Configurações'
      },
    ]

    return [...navigationShortcuts, ...customShortcuts]
  }, [router, customShortcuts])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignorar se estiver digitando em um input/textarea
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Exceto para atalhos específicos que devem funcionar sempre
      if (!(event.ctrlKey || event.metaKey)) {
        return
      }
    }

    for (const shortcut of allShortcuts) {
      const ctrlMatch = shortcut.ctrl
        ? (event.ctrlKey || event.metaKey)
        : !(event.ctrlKey || event.metaKey)
      const altMatch = shortcut.alt ? event.altKey : !event.altKey
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()

      if (ctrlMatch && altMatch && shiftMatch && keyMatch) {
        event.preventDefault()
        shortcut.handler()
        return
      }
    }
  }, [allShortcuts])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return {
    shortcuts: allShortcuts
  }
}

// Hook para atalhos específicos do chat
export function useChatShortcuts({
  onSend,
  onEmojiPicker,
  onQuickReplies,
  onAttachment,
}: {
  onSend?: () => void
  onEmojiPicker?: () => void
  onQuickReplies?: () => void
  onAttachment?: () => void
}) {
  const shortcuts: ShortcutConfig[] = []

  if (onSend) {
    shortcuts.push({
      key: 'Enter',
      handler: onSend,
      description: 'Enviar mensagem'
    })
  }

  if (onEmojiPicker) {
    shortcuts.push({
      key: 'e',
      ctrl: true,
      handler: onEmojiPicker,
      description: 'Abrir emojis'
    })
  }

  if (onQuickReplies) {
    shortcuts.push({
      key: '/',
      handler: onQuickReplies,
      description: 'Respostas rápidas'
    })
  }

  if (onAttachment) {
    shortcuts.push({
      key: 'u',
      ctrl: true,
      handler: onAttachment,
      description: 'Anexar arquivo'
    })
  }

  return useKeyboardShortcuts(shortcuts)
}

// Componente para mostrar atalhos disponíveis
export function getShortcutsList() {
  return [
    { keys: ['Ctrl', 'K'], description: 'Busca global' },
    { keys: ['Ctrl', '1'], description: 'Dashboard' },
    { keys: ['Ctrl', '2'], description: 'Inbox' },
    { keys: ['Ctrl', '3'], description: 'Kanban' },
    { keys: ['Ctrl', '4'], description: 'Contatos' },
    { keys: ['Ctrl', '5'], description: 'Automações' },
    { keys: ['Ctrl', ','], description: 'Configurações' },
    { keys: ['Ctrl', 'E'], description: 'Emojis (no chat)' },
    { keys: ['Ctrl', 'U'], description: 'Anexar arquivo (no chat)' },
    { keys: ['/'], description: 'Respostas rápidas (no chat)' },
    { keys: ['Enter'], description: 'Enviar mensagem' },
    { keys: ['Esc'], description: 'Fechar modal/popup' },
  ]
}
