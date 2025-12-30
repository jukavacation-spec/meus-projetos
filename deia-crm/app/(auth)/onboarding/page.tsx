'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Check, Building2, MessageSquare, QrCode, CreditCard, CheckCircle2 } from 'lucide-react'
import { useInstanceStatusPolling } from '@/hooks/useInstances'

type Step = 'plan' | 'company' | 'whatsapp' | 'qrcode'
type Plan = 'basico' | 'pro'

const PLANS = {
  basico: {
    name: 'Basico',
    price: 250,
    features: [
      '1 conexao WhatsApp inclusa',
      'Ate 2 conexoes adicionais (R$100 cada)',
      'Ate 5 membros na equipe',
      'Inbox no Chatwoot',
      'Gestao de contatos',
      'Kanban de atendimento',
    ],
  },
  pro: {
    name: 'Pro',
    price: 500,
    features: [
      'Ate 10 conexoes WhatsApp',
      'Ate 50 membros na equipe',
      'Multiplas inboxes',
      'Controle de acesso por inbox',
      'Relatorios avancados',
      'Suporte prioritario',
    ],
  },
}

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState<Step>('plan')
  const [selectedPlan, setSelectedPlan] = useState<Plan>('basico')
  const [companyName, setCompanyName] = useState('')
  const [instanceName, setInstanceName] = useState('')
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Polling para QR code
  const { status, qrCode } = useInstanceStatusPolling(
    instanceId,
    currentStep === 'qrcode'
  )

  // Redirecionar quando conectar
  useEffect(() => {
    if (status === 'connected') {
      setTimeout(() => {
        router.push('/')
      }, 1500)
    }
  }, [status, router])

  const handlePlanSubmit = () => {
    setCurrentStep('company')
  }

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/onboarding/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, plan: selectedPlan }),
      })

      const data = await response.json()

      if (data.success) {
        setCurrentStep('whatsapp')
      } else {
        setError(data.error || 'Erro ao criar empresa')
      }
    } catch {
      setError('Erro de conexao. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleWhatsAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/integracoes/whatsapp/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName }),
      })

      const data = await response.json()

      if (data.success && data.instance) {
        setInstanceId(data.instance.id)
        setCurrentStep('qrcode')
      } else {
        setError(data.error || 'Erro ao criar instancia WhatsApp')
      }
    } catch {
      setError('Erro de conexao. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const steps = [
    { id: 'plan', label: 'Plano', icon: CreditCard },
    { id: 'company', label: 'Empresa', icon: Building2 },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { id: 'qrcode', label: 'Conectar', icon: QrCode },
  ]

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)

  return (
    <div className="w-full max-w-lg mx-auto">
      <Card>
        <CardHeader className="text-center">
          <img
            src="/logo-icon.png"
            alt="FalDesk"
            className="mx-auto mb-4 h-24 w-24 object-contain dark:invert"
          />
          <CardTitle className="text-2xl">
            {currentStep === 'plan' && 'Escolha seu plano'}
            {currentStep === 'company' && 'Dados da empresa'}
            {currentStep === 'whatsapp' && 'Conectar WhatsApp'}
            {currentStep === 'qrcode' && 'Escanear QR Code'}
          </CardTitle>
          <CardDescription>
            {currentStep === 'plan' && 'Selecione o plano ideal para o seu negocio'}
            {currentStep === 'company' && 'Informe o nome da sua empresa'}
            {currentStep === 'whatsapp' && 'Configure sua primeira conexao WhatsApp (inclusa no plano)'}
            {currentStep === 'qrcode' && 'Abra o WhatsApp no seu celular e escaneie o codigo'}
          </CardDescription>
        </CardHeader>

        {/* Progress Steps */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-center gap-2">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isCompleted = index < currentStepIndex
              const isCurrent = index === currentStepIndex

              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                      isCompleted
                        ? 'bg-primary border-primary text-primary-foreground'
                        : isCurrent
                        ? 'border-primary text-primary'
                        : 'border-muted-foreground/30 text-muted-foreground/50'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-12 h-0.5 mx-1 ${
                        index < currentStepIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex justify-center gap-8 mt-2">
            {steps.map((step, index) => (
              <span
                key={step.id}
                className={`text-xs ${
                  index <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground/50'
                }`}
              >
                {step.label}
              </span>
            ))}
          </div>
        </div>

        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Step 1: Plan Selection */}
          {currentStep === 'plan' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {(Object.entries(PLANS) as [Plan, typeof PLANS.basico][]).map(([planKey, planData]) => (
                  <div
                    key={planKey}
                    onClick={() => setSelectedPlan(planKey)}
                    className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${
                      selectedPlan === planKey
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    {selectedPlan === planKey && (
                      <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-primary" />
                    )}
                    <div className="flex items-baseline gap-2 mb-2">
                      <h3 className="font-semibold text-lg">Plano {planData.name}</h3>
                      <span className="text-2xl font-bold">R${planData.price}</span>
                      <span className="text-muted-foreground text-sm">/mes</span>
                    </div>
                    <ul className="space-y-1">
                      {planData.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="h-3 w-3 text-primary flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <Button onClick={handlePlanSubmit} className="w-full">
                Continuar com Plano {PLANS[selectedPlan].name}
              </Button>
            </div>
          )}

          {/* Step 2: Company */}
          {currentStep === 'company' && (
            <form onSubmit={handleCompanySubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Nome da sua empresa</Label>
                <Input
                  id="companyName"
                  type="text"
                  placeholder="Minha Empresa Ltda"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  minLength={2}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Este nome aparecera para seus clientes nas conversas
                </p>
              </div>

              {/* Info sobre o plano selecionado */}
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">Plano {PLANS[selectedPlan].name} - R${PLANS[selectedPlan].price}/mes</p>
                <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
                  {PLANS[selectedPlan].features.slice(0, 3).map((feature, idx) => (
                    <li key={idx}>{feature}</li>
                  ))}
                </ul>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Continuar'
                )}
              </Button>
            </form>
          )}

          {/* Step 3: WhatsApp Instance */}
          {currentStep === 'whatsapp' && (
            <form onSubmit={handleWhatsAppSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="instanceName">Nome desta conexao</Label>
                <Input
                  id="instanceName"
                  type="text"
                  placeholder="Comercial"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  required
                  minLength={2}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Ex: Comercial, Suporte, Vendas. Voce pode adicionar mais conexoes depois.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando instancia...
                  </>
                ) : (
                  'Continuar'
                )}
              </Button>
            </form>
          )}

          {/* Step 4: QR Code */}
          {currentStep === 'qrcode' && (
            <div className="space-y-4">
              {status === 'connected' ? (
                <div className="text-center py-8">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-green-600">
                    WhatsApp conectado!
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Redirecionando para o dashboard...
                  </p>
                </div>
              ) : qrCode ? (
                <div className="text-center">
                  <div className="bg-white p-4 rounded-lg inline-block">
                    <img
                      src={qrCode}
                      alt="QR Code"
                      className="w-64 h-64 mx-auto"
                    />
                  </div>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">Como escanear:</p>
                    <ol className="text-xs text-muted-foreground text-left list-decimal list-inside space-y-1">
                      <li>Abra o WhatsApp no seu celular</li>
                      <li>Toque em Menu ou Configuracoes</li>
                      <li>Selecione &quot;Aparelhos conectados&quot;</li>
                      <li>Toque em &quot;Conectar um aparelho&quot;</li>
                      <li>Aponte a camera para este codigo</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground mt-4">
                    {status === 'connecting' ? 'Gerando QR Code...' : 'Preparando conexao...'}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
