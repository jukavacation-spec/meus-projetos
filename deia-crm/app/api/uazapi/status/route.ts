import { NextResponse } from 'next/server'

export type UazapiInstanceData = {
  id: string
  name: string
  profileName: string
  profilePicUrl: string
  phoneNumber: string
  platform: string
  isBusiness: boolean
  status: 'connected' | 'disconnected' | 'connecting' | 'qr_code'
  rawStatus: string
  presence: string
  lastDisconnect: string | null
  lastDisconnectReason: string | null
  createdAt: string
}

export async function POST(request: Request) {
  try {
    const { apiUrl, apiToken } = await request.json()

    if (!apiUrl || !apiToken) {
      return NextResponse.json(
        { success: false, error: 'URL da API e Token sao obrigatorios' },
        { status: 400 }
      )
    }

    // Normaliza a URL removendo trailing slash
    const baseUrl = apiUrl.replace(/\/+$/, '')

    // UAZAPI GO v2.0 - O token da instancia identifica a instancia
    // Header correto: token: {instance_token}
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'token': apiToken,
    }

    console.log(`[UAZAPI Status] Chamando ${baseUrl}/instance/status`)

    const response = await fetch(`${baseUrl}/instance/status`, {
      method: 'GET',
      headers,
    })

    console.log(`[UAZAPI Status] Response status: ${response.status}`)

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({
          success: false,
          error: 'Token de instancia invalido',
        })
      }
      if (response.status === 404) {
        return NextResponse.json({
          success: false,
          error: 'Instancia nao encontrada',
        })
      }

      // Tentar ler o erro da resposta
      try {
        const errorData = await response.json()
        console.log(`[UAZAPI Status] Erro:`, errorData)
        return NextResponse.json({
          success: false,
          error: errorData.message || `Erro ${response.status}: ${response.statusText}`,
        })
      } catch {
        return NextResponse.json({
          success: false,
          error: `Erro ${response.status}: ${response.statusText}`,
        })
      }
    }

    const data = await response.json()
    console.log(`[UAZAPI Status] Resposta:`, JSON.stringify(data).substring(0, 500))

    // UAZAPI GO v2.0 retorna formato:
    // { instance: { id, token, status, name, profileName, profilePicUrl, owner, plataform, isBusiness, ... }, status: { connected, jid, loggedIn } }

    const instanceData = data.instance || {}
    const statusData = data.status || {}

    // Determinar o status normalizado
    let normalizedStatus: 'connected' | 'disconnected' | 'connecting' | 'qr_code'

    if (statusData.connected || statusData.loggedIn) {
      normalizedStatus = 'connected'
    } else if (instanceData.status === 'qrcode' || instanceData.status === 'waiting') {
      normalizedStatus = 'qr_code'
    } else if (instanceData.status === 'connecting') {
      normalizedStatus = 'connecting'
    } else {
      normalizedStatus = 'disconnected'
    }

    // Extrair numero do telefone do owner ou jid
    let phoneNumber = instanceData.owner || null
    if (!phoneNumber && statusData.jid) {
      // jid formato: 554799286969:84@s.whatsapp.net
      phoneNumber = statusData.jid.split(':')[0] || statusData.jid.split('@')[0]
    }

    // Formatar numero para exibicao (ex: +55 47 99286-969)
    let formattedPhone = phoneNumber
    if (phoneNumber && phoneNumber.length >= 10) {
      const digits = phoneNumber.replace(/\D/g, '')
      if (digits.length === 13) {
        // Formato brasileiro com codigo do pais: 55 + DDD + numero
        formattedPhone = `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`
      } else if (digits.length === 12) {
        formattedPhone = `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`
      }
    }

    const instanceInfo: UazapiInstanceData = {
      id: instanceData.id || '',
      name: instanceData.name || '',
      profileName: instanceData.profileName || instanceData.name || '',
      profilePicUrl: instanceData.profilePicUrl || '',
      phoneNumber: formattedPhone || phoneNumber || '',
      platform: instanceData.plataform || instanceData.platform || 'unknown',
      isBusiness: instanceData.isBusiness || false,
      status: normalizedStatus,
      rawStatus: instanceData.status || 'unknown',
      presence: instanceData.current_presence || 'unavailable',
      lastDisconnect: instanceData.lastDisconnect || null,
      lastDisconnectReason: instanceData.lastDisconnectReason || null,
      createdAt: instanceData.created || '',
    }

    return NextResponse.json({
      success: true,
      instance: instanceInfo,
      // Manter campos antigos para compatibilidade
      status: normalizedStatus,
      rawStatus: instanceData.status || 'unknown',
      phoneNumber: formattedPhone || phoneNumber || null,
      instanceName: instanceData.name || null,
      profileName: instanceData.profileName || null,
    })
  } catch (error) {
    console.error('[UAZAPI Status] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao conectar com UAZAPI. Verifique a URL e credenciais.' },
      { status: 500 }
    )
  }
}
