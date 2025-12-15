export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  AGENT: 'agent',
  VIEWER: 'viewer',
} as const

export type RoleName = typeof ROLES[keyof typeof ROLES]

export const DEFAULT_ROLES = [
  {
    name: 'owner',
    display_name: 'Proprietario',
    is_system: true,
    permissions: {
      contacts: { read: true, write: true, delete: true },
      kanban: { read: true, move: true, configure: true },
      team: { read: true, manage: true },
      settings: { read: true, write: true },
      reports: { read: true },
      billing: { read: true, write: true },
    },
  },
  {
    name: 'admin',
    display_name: 'Administrador',
    is_system: true,
    permissions: {
      contacts: { read: true, write: true, delete: true },
      kanban: { read: true, move: true, configure: true },
      team: { read: true, manage: true },
      settings: { read: true, write: true },
      reports: { read: true },
      billing: { read: false, write: false },
    },
  },
  {
    name: 'supervisor',
    display_name: 'Supervisor',
    is_system: true,
    permissions: {
      contacts: { read: true, write: true, delete: false },
      kanban: { read: true, move: true, configure: false },
      team: { read: true, manage: false },
      settings: { read: true, write: false },
      reports: { read: true },
      billing: { read: false, write: false },
    },
  },
  {
    name: 'agent',
    display_name: 'Agente',
    is_system: true,
    permissions: {
      contacts: { read: true, write: true, delete: false },
      kanban: { read: true, move: true, configure: false },
      team: { read: true, manage: false },
      settings: { read: false, write: false },
      reports: { read: false },
      billing: { read: false, write: false },
    },
  },
  {
    name: 'viewer',
    display_name: 'Visualizador',
    is_system: true,
    permissions: {
      contacts: { read: true, write: false, delete: false },
      kanban: { read: true, move: false, configure: false },
      team: { read: true, manage: false },
      settings: { read: false, write: false },
      reports: { read: true },
      billing: { read: false, write: false },
    },
  },
]
