import type { Json } from '@/types/database'

export type Permission = {
  read?: boolean
  write?: boolean
  delete?: boolean
  move?: boolean
  configure?: boolean
  manage?: boolean
}

export type Permissions = {
  contacts?: Permission
  kanban?: Permission
  team?: Permission
  settings?: Permission
  reports?: Permission
  billing?: Permission
}

/**
 * Verifica se o usuario tem uma permissao especifica
 */
export function hasPermission(
  permissions: Json | null,
  resource: keyof Permissions,
  action: keyof Permission
): boolean {
  if (!permissions || typeof permissions !== 'object') {
    return false
  }

  const perms = permissions as Permissions
  const resourcePerms = perms[resource]

  if (!resourcePerms) {
    return false
  }

  return resourcePerms[action] === true
}

/**
 * Verifica se o usuario pode ler um recurso
 */
export function canRead(permissions: Json | null, resource: keyof Permissions): boolean {
  return hasPermission(permissions, resource, 'read')
}

/**
 * Verifica se o usuario pode escrever em um recurso
 */
export function canWrite(permissions: Json | null, resource: keyof Permissions): boolean {
  return hasPermission(permissions, resource, 'write')
}

/**
 * Verifica se o usuario pode deletar um recurso
 */
export function canDelete(permissions: Json | null, resource: keyof Permissions): boolean {
  return hasPermission(permissions, resource, 'delete')
}

/**
 * Verifica se o usuario pode gerenciar um recurso
 */
export function canManage(permissions: Json | null, resource: keyof Permissions): boolean {
  return hasPermission(permissions, resource, 'manage')
}
