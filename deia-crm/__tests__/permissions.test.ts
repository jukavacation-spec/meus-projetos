import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  canRead,
  canWrite,
  canDelete,
  canManage,
} from '@/lib/utils/permissions'

describe('hasPermission', () => {
  it('should return true when permission exists and is true', () => {
    const permissions = {
      contacts: { read: true, write: false },
    }
    expect(hasPermission(permissions, 'contacts', 'read')).toBe(true)
  })

  it('should return false when permission exists but is false', () => {
    const permissions = {
      contacts: { read: true, write: false },
    }
    expect(hasPermission(permissions, 'contacts', 'write')).toBe(false)
  })

  it('should return false when resource does not exist', () => {
    const permissions = {
      contacts: { read: true },
    }
    expect(hasPermission(permissions, 'team', 'read')).toBe(false)
  })

  it('should return false when permissions is null', () => {
    expect(hasPermission(null, 'contacts', 'read')).toBe(false)
  })

  it('should return false when permissions is not an object', () => {
    expect(hasPermission('invalid' as unknown, 'contacts', 'read')).toBe(false)
  })

  it('should return false when action does not exist', () => {
    const permissions = {
      contacts: { read: true },
    }
    expect(hasPermission(permissions, 'contacts', 'delete')).toBe(false)
  })
})

describe('canRead', () => {
  it('should return true when read permission is true', () => {
    const permissions = { kanban: { read: true } }
    expect(canRead(permissions, 'kanban')).toBe(true)
  })

  it('should return false when read permission is false', () => {
    const permissions = { kanban: { read: false } }
    expect(canRead(permissions, 'kanban')).toBe(false)
  })
})

describe('canWrite', () => {
  it('should return true when write permission is true', () => {
    const permissions = { team: { write: true } }
    expect(canWrite(permissions, 'team')).toBe(true)
  })

  it('should return false when write permission is missing', () => {
    const permissions = { team: { read: true } }
    expect(canWrite(permissions, 'team')).toBe(false)
  })
})

describe('canDelete', () => {
  it('should return true when delete permission is true', () => {
    const permissions = { contacts: { delete: true } }
    expect(canDelete(permissions, 'contacts')).toBe(true)
  })
})

describe('canManage', () => {
  it('should return true when manage permission is true', () => {
    const permissions = { settings: { manage: true } }
    expect(canManage(permissions, 'settings')).toBe(true)
  })

  it('should return false for null permissions', () => {
    expect(canManage(null, 'settings')).toBe(false)
  })
})
