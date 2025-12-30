'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Key, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'

export function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Validacoes
  const passwordMinLength = 8
  const passwordsMatch = newPassword === confirmPassword
  const newPasswordValid = newPassword.length >= passwordMinLength
  const canSubmit = currentPassword.length > 0 && newPasswordValid && passwordsMatch

  const handleChangePassword = async () => {
    if (!canSubmit) return

    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createClient()

      // Verificar senha atual re-autenticando
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) throw new Error('Usuario nao encontrado')

      // Tentar fazer login com senha atual para validar
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })

      if (signInError) {
        throw new Error('Senha atual incorreta')
      }

      // Atualizar senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) throw updateError

      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar senha')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-medium">Alterar Senha</h3>
        <p className="text-sm text-muted-foreground">
          Mantenha sua conta segura atualizando sua senha regularmente
        </p>
      </div>

      <div className="space-y-4">
        {/* Senha Atual */}
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Senha Atual</Label>
          <div className="relative">
            <Input
              id="currentPassword"
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Digite sua senha atual"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            >
              {showCurrentPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Nova Senha */}
        <div className="space-y-2">
          <Label htmlFor="newPassword">Nova Senha</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Digite sua nova senha"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          {newPassword.length > 0 && !newPasswordValid && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              A senha deve ter pelo menos {passwordMinLength} caracteres
            </p>
          )}
          {newPasswordValid && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Senha valida
            </p>
          )}
        </div>

        {/* Confirmar Nova Senha */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirme sua nova senha"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              As senhas nao coincidem
            </p>
          )}
          {confirmPassword.length > 0 && passwordsMatch && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              As senhas coincidem
            </p>
          )}
        </div>
      </div>

      {/* Mensagens de erro/sucesso */}
      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 text-green-600 text-sm p-3 rounded-md flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Senha alterada com sucesso!
        </div>
      )}

      {/* Botao de salvar */}
      <div className="flex justify-end">
        <Button onClick={handleChangePassword} disabled={isSaving || !canSubmit}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Alterando...
            </>
          ) : (
            <>
              <Key className="h-4 w-4 mr-2" />
              Alterar Senha
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
