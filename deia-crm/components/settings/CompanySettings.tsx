'use client'

import { useState, useEffect } from 'react'
import { useCompany } from '@/hooks/useCompany'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Building2,
  Save,
  Loader2,
  Crown,
} from 'lucide-react'

const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Brasilia (GMT-3)' },
  { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { value: 'America/Belem', label: 'Belem (GMT-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (GMT-3)' },
  { value: 'America/Recife', label: 'Recife (GMT-3)' },
  { value: 'America/Cuiaba', label: 'Cuiaba (GMT-4)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (GMT-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
]

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: 'Gratuito', color: 'bg-gray-500' },
  starter: { label: 'Starter', color: 'bg-blue-500' },
  pro: { label: 'Pro', color: 'bg-purple-500' },
  enterprise: { label: 'Enterprise', color: 'bg-amber-500' },
}

export function CompanySettings() {
  const { company, isLoading, isSaving, updateCompany } = useCompany()

  // Form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [timezone, setTimezone] = useState('America/Sao_Paulo')
  const [supportEmail, setSupportEmail] = useState('')
  const [supportPhone, setSupportPhone] = useState('')

  // UI state
  const [hasChanges, setHasChanges] = useState(false)

  // Populate form when company loads
  useEffect(() => {
    if (company) {
      setName(company.name || '')
      setSlug(company.slug || '')
      setTimezone(company.settings?.timezone || 'America/Sao_Paulo')
      setSupportEmail(company.settings?.support_email || '')
      setSupportPhone(company.settings?.support_phone || '')
    }
  }, [company])

  // Track changes
  useEffect(() => {
    if (!company) return

    const changed =
      name !== (company.name || '') ||
      slug !== (company.slug || '') ||
      timezone !== (company.settings?.timezone || 'America/Sao_Paulo') ||
      supportEmail !== (company.settings?.support_email || '') ||
      supportPhone !== (company.settings?.support_phone || '')

    setHasChanges(changed)
  }, [company, name, slug, timezone, supportEmail, supportPhone])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome da empresa e obrigatorio')
      return
    }

    if (!slug.trim()) {
      toast.error('Slug e obrigatorio')
      return
    }

    const result = await updateCompany({
      name: name.trim(),
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      settings: {
        timezone,
        support_email: supportEmail.trim() || undefined,
        support_phone: supportPhone.trim() || undefined,
      },
    })

    if (result?.success) {
      toast.success('Configuracoes salvas com sucesso!')
      setHasChanges(false)
    } else {
      toast.error('Erro ao salvar configuracoes')
    }
  }

  const generateSlug = () => {
    const newSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    setSlug(newSlug)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!company) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma empresa encontrada</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const planInfo = PLAN_LABELS[company.plan] || PLAN_LABELS.free

  return (
    <div className="space-y-6">
      {/* Dados Basicos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Dados da Empresa
          </CardTitle>
          <CardDescription>
            Informacoes basicas da sua empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Empresa *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Minha Empresa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL) *</Label>
              <div className="flex gap-2">
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="minha-empresa"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateSlug}
                  className="shrink-0"
                >
                  Gerar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Usado na URL: app.deiacrm.com/{slug || 'sua-empresa'}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="timezone">Fuso Horario</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Plano Atual</Label>
              <div className="flex items-center gap-2 h-10">
                <Badge className={`${planInfo.color} text-white`}>
                  <Crown className="h-3 w-3 mr-1" />
                  {planInfo.label}
                </Badge>
                {company.plan === 'free' && (
                  <Button variant="link" size="sm" className="text-primary">
                    Fazer upgrade
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contato/Suporte */}
      <Card>
        <CardHeader>
          <CardTitle>Informacoes de Contato</CardTitle>
          <CardDescription>
            Dados de contato da sua empresa (opcional)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="support-email">Email de Suporte</Label>
              <Input
                id="support-email"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="suporte@empresa.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-phone">Telefone de Suporte</Label>
              <Input
                id="support-phone"
                type="tel"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botao Salvar */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="min-w-32"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Alteracoes
        </Button>
      </div>
    </div>
  )
}
