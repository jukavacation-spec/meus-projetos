export const PLANS = {
  basico: {
    name: 'Basico',
    maxInstances: 1,              // 1 integracao inclusa
    maxAdditionalInstances: 2,    // ate 2 adicionais
    maxMembers: 5,
    price: 250,
    additionalInstancePrice: 100,
    features: [
      '1 conexao WhatsApp inclusa',
      'Ate 2 conexoes adicionais (R$100 cada)',
      'Ate 5 membros',
      'Inbox no Chatwoot',
      'Gestao de contatos',
      'Kanban de atendimento',
    ],
  },
  pro: {
    name: 'Pro',
    maxInstances: 10,             // 10 integracoes inclusas
    maxAdditionalInstances: 0,    // sem adicionais (ja tem 10)
    maxMembers: 50,
    price: 500,
    additionalInstancePrice: 0,
    features: [
      'Ate 10 conexoes WhatsApp',
      'Ate 50 membros',
      'Multiplas inboxes',
      'Controle de acesso por inbox',
      'Relatorios avancados',
      'Suporte prioritario',
    ],
  },
} as const

export type PlanType = keyof typeof PLANS

export function getPlanLimits(plan: string | null | undefined) {
  const planKey = (plan || 'basico') as PlanType
  return PLANS[planKey] || PLANS.basico
}

/**
 * Calcula o limite total de instancias (base + adicionais compradas)
 */
export function getMaxInstances(plan: string | null | undefined, additionalPurchased: number = 0): number {
  const limits = getPlanLimits(plan)
  return limits.maxInstances + Math.min(additionalPurchased, limits.maxAdditionalInstances)
}

/**
 * Verifica se pode criar uma nova instancia
 */
export function canCreateInstance(
  plan: string | null | undefined,
  currentCount: number,
  additionalPurchased: number = 0
): boolean {
  const maxAllowed = getMaxInstances(plan, additionalPurchased)
  return currentCount < maxAllowed
}

/**
 * Verifica se pode comprar instancia adicional
 */
export function canPurchaseAdditional(plan: string | null | undefined, currentAdditional: number): boolean {
  const limits = getPlanLimits(plan)
  return currentAdditional < limits.maxAdditionalInstances
}

/**
 * Retorna o preco de uma instancia adicional
 */
export function getAdditionalInstancePrice(plan: string | null | undefined): number {
  const limits = getPlanLimits(plan)
  return limits.additionalInstancePrice
}

/**
 * Retorna quantas instancias adicionais ainda podem ser compradas
 */
export function getRemainingAdditionalSlots(plan: string | null | undefined, currentAdditional: number): number {
  const limits = getPlanLimits(plan)
  return Math.max(0, limits.maxAdditionalInstances - currentAdditional)
}

export function canAddMember(plan: string | null | undefined, currentCount: number): boolean {
  const limits = getPlanLimits(plan)
  return currentCount < limits.maxMembers
}

export function getRemainingInstances(
  plan: string | null | undefined,
  currentCount: number,
  additionalPurchased: number = 0
): number {
  const maxAllowed = getMaxInstances(plan, additionalPurchased)
  return Math.max(0, maxAllowed - currentCount)
}

export function getRemainingMembers(plan: string | null | undefined, currentCount: number): number {
  const limits = getPlanLimits(plan)
  return Math.max(0, limits.maxMembers - currentCount)
}
