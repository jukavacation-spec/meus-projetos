/**
 * Normaliza numero de telefone para formato internacional
 * Remove todos os caracteres nao numericos e adiciona codigo do pais se necessario
 */
export function normalizePhone(phone: string): string {
  // Remove tudo que nao for numero
  const digits = phone.replace(/\D/g, '')

  // Se ja tem 13 digitos (55 + DDD + numero), retorna
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+${digits}`
  }

  // Se tem 11 digitos (DDD + numero), adiciona 55
  if (digits.length === 11) {
    return `+55${digits}`
  }

  // Se tem 12 digitos e comeca com 55
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+${digits}`
  }

  // Retorna com + se nao tem
  return digits.startsWith('+') ? phone : `+${digits}`
}

/**
 * Formata telefone para exibicao
 * +5511999999999 -> (11) 99999-9999
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')

  // Remove codigo do pais se existir
  const localDigits = digits.startsWith('55') ? digits.slice(2) : digits

  if (localDigits.length === 11) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`
  }

  if (localDigits.length === 10) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`
  }

  return phone
}

/**
 * Valida se e um numero de telefone brasileiro valido
 */
export function isValidBrazilianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')

  // Deve ter 10 ou 11 digitos (sem codigo do pais)
  // ou 12 ou 13 digitos (com codigo do pais)
  if (digits.length < 10 || digits.length > 13) {
    return false
  }

  // Se tem codigo do pais, deve ser 55
  if (digits.length >= 12 && !digits.startsWith('55')) {
    return false
  }

  return true
}

/**
 * Extrai o DDD do telefone
 */
export function extractDDD(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  const localDigits = digits.startsWith('55') ? digits.slice(2) : digits

  if (localDigits.length >= 10) {
    return localDigits.slice(0, 2)
  }

  return null
}
