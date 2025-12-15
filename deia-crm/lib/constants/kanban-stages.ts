export const DEFAULT_KANBAN_STAGES = [
  {
    name: 'Novo',
    slug: 'novo',
    description: 'Leads que acabaram de chegar',
    color: '#6366f1',
    position: 0,
    is_initial: true,
    is_final: false,
  },
  {
    name: 'Triagem',
    slug: 'triagem',
    description: 'Em processo de qualificacao',
    color: '#f59e0b',
    position: 1,
    is_initial: false,
    is_final: false,
  },
  {
    name: 'Em Atendimento',
    slug: 'em-atendimento',
    description: 'Atendimento em andamento',
    color: '#3b82f6',
    position: 2,
    is_initial: false,
    is_final: false,
  },
  {
    name: 'Aguardando Cliente',
    slug: 'aguardando-cliente',
    description: 'Esperando retorno do cliente',
    color: '#8b5cf6',
    position: 3,
    is_initial: false,
    is_final: false,
  },
  {
    name: 'Proposta Enviada',
    slug: 'proposta-enviada',
    description: 'Proposta/orcamento enviado',
    color: '#ec4899',
    position: 4,
    is_initial: false,
    is_final: false,
  },
  {
    name: 'Fechado - Ganho',
    slug: 'fechado-ganho',
    description: 'Negocio fechado com sucesso',
    color: '#22c55e',
    position: 5,
    is_initial: false,
    is_final: true,
  },
  {
    name: 'Fechado - Perdido',
    slug: 'fechado-perdido',
    description: 'Negocio perdido',
    color: '#ef4444',
    position: 6,
    is_initial: false,
    is_final: true,
  },
]

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa', color: '#6b7280' },
  { value: 'normal', label: 'Normal', color: '#3b82f6' },
  { value: 'high', label: 'Alta', color: '#f59e0b' },
  { value: 'urgent', label: 'Urgente', color: '#ef4444' },
]

export const STATUS_OPTIONS = [
  { value: 'open', label: 'Aberto' },
  { value: 'pending', label: 'Pendente' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'archived', label: 'Arquivado' },
]
