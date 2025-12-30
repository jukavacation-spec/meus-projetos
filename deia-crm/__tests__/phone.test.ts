import { describe, it, expect } from 'vitest'
import {
  normalizePhone,
  formatPhone,
  isValidBrazilianPhone,
  extractDDD,
} from '@/lib/utils/phone'

describe('normalizePhone', () => {
  it('should normalize phone with 11 digits (DDD + number)', () => {
    expect(normalizePhone('11999887766')).toBe('+5511999887766')
  })

  it('should normalize phone with 13 digits starting with 55', () => {
    expect(normalizePhone('5511999887766')).toBe('+5511999887766')
  })

  it('should normalize phone with 12 digits starting with 55', () => {
    expect(normalizePhone('551199988776')).toBe('+551199988776')
  })

  it('should remove non-numeric characters', () => {
    expect(normalizePhone('(11) 99988-7766')).toBe('+5511999887766')
    expect(normalizePhone('+55 11 99988-7766')).toBe('+5511999887766')
  })

  it('should add + prefix if missing', () => {
    expect(normalizePhone('5511999887766')).toBe('+5511999887766')
  })

  it('should handle already formatted numbers', () => {
    expect(normalizePhone('+5511999887766')).toBe('+5511999887766')
  })
})

describe('formatPhone', () => {
  it('should format 11-digit phone (celular)', () => {
    expect(formatPhone('+5511999887766')).toBe('(11) 99988-7766')
    expect(formatPhone('5511999887766')).toBe('(11) 99988-7766')
    expect(formatPhone('11999887766')).toBe('(11) 99988-7766')
  })

  it('should format 10-digit phone (fixo)', () => {
    expect(formatPhone('+551133445566')).toBe('(11) 3344-5566')
    expect(formatPhone('1133445566')).toBe('(11) 3344-5566')
  })

  it('should return original if cannot format', () => {
    expect(formatPhone('123')).toBe('123')
    expect(formatPhone('invalid')).toBe('invalid')
  })
})

describe('isValidBrazilianPhone', () => {
  it('should return true for valid phones', () => {
    expect(isValidBrazilianPhone('11999887766')).toBe(true) // 11 digits
    expect(isValidBrazilianPhone('1133445566')).toBe(true) // 10 digits
    expect(isValidBrazilianPhone('5511999887766')).toBe(true) // 13 digits with 55
    expect(isValidBrazilianPhone('551133445566')).toBe(true) // 12 digits with 55
  })

  it('should return false for invalid phones', () => {
    expect(isValidBrazilianPhone('123456789')).toBe(false) // too short
    expect(isValidBrazilianPhone('12345678901234')).toBe(false) // too long
    expect(isValidBrazilianPhone('1111999887766')).toBe(false) // 13 digits without 55
  })

  it('should handle formatted numbers', () => {
    expect(isValidBrazilianPhone('(11) 99988-7766')).toBe(true)
    expect(isValidBrazilianPhone('+55 11 99988-7766')).toBe(true)
  })
})

describe('extractDDD', () => {
  it('should extract DDD from various formats', () => {
    expect(extractDDD('11999887766')).toBe('11')
    expect(extractDDD('5511999887766')).toBe('11')
    expect(extractDDD('+5521999887766')).toBe('21')
    expect(extractDDD('(31) 99988-7766')).toBe('31')
  })

  it('should return null for invalid phones', () => {
    expect(extractDDD('123')).toBe(null)
    expect(extractDDD('')).toBe(null)
  })
})
