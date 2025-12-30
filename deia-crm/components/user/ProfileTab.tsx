'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Save, Upload } from 'lucide-react'

type ProfileTabProps = {
  onClose: () => void
}

export function ProfileTab({ onClose }: ProfileTabProps) {
  const { profile } = useAuth()
  const [name, setName] = useState(profile?.name || '')
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    if (!profile) return

    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createClient()

      // 1. Atualizar nome e display_name no Supabase
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name,
          display_name: displayName || null
        })
        .eq('id', profile.id)

      if (updateError) throw updateError

      // 2. Sincronizar com Chatwoot (se tiver chatwoot_agent_id)
      if (profile.chatwoot_agent_id) {
        try {
          await fetch(`/api/chatwoot/agents/${profile.chatwoot_agent_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: name,
              display_name: displayName || ''
            }),
          })
        } catch {
          // Falha silenciosa na sincronizacao com Chatwoot
        }
      }

      setSuccess(true)

      // Recarregar a pagina para atualizar o contexto
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setIsSaving(false)
    }
  }

  const userInitial = profile?.name?.charAt(0)?.toUpperCase() || 'U'

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="space-y-2">
        <Label>Foto do perfil</Label>
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-2xl">{userInitial}</AvatarFallback>
          </Avatar>
          <div>
            <Button variant="outline" size="sm" disabled>
              <Upload className="h-4 w-4 mr-2" />
              Alterar foto
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              Em breve
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Nome Completo */}
        <div className="space-y-2">
          <Label htmlFor="name">Seu nome completo</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Digite seu nome completo"
          />
        </div>

        {/* Nome para Exibicao */}
        <div className="space-y-2">
          <Label htmlFor="displayName">Nome para exibicao</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nome que aparecera nas mensagens"
          />
          <p className="text-xs text-muted-foreground">
            Se vazio, nenhum nome sera exibido nas mensagens ao cliente
          </p>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Seu e-mail</Label>
          <Input
            id="email"
            value={profile?.email || ''}
            disabled
            className="bg-muted"
          />
        </div>
      </div>

      {/* Mensagens de erro/sucesso */}
      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 text-green-600 text-sm p-3 rounded-md">
          Perfil atualizado com sucesso!
        </div>
      )}

      {/* Botoes */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
