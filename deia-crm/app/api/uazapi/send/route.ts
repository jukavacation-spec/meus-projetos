import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rate-limit'

export type SendMessageRequest = {
  apiUrl: string
  apiToken: string
  to: string // Phone number (e.g., 5547999999999)
  message: string
  // Optional fields for media
  mediaUrl?: string
  mediaType?: 'image' | 'document' | 'audio' | 'video'
  fileName?: string
  caption?: string
}

export type SendMessageResponse = {
  success: boolean
  messageId?: string
  error?: string
  rawResponse?: unknown
}

// Dominios permitidos para UAZAPI (whitelist de seguranca)
const ALLOWED_UAZAPI_DOMAINS = [
  'uazapi.com',
  'uazapi.dev',
  'faltech.uazapi.com',
  'free.uazapi.com',
]

/**
 * Valida se a URL é segura e pertence a um domínio permitido
 * Previne ataques SSRF (Server-Side Request Forgery)
 */
function isValidUazapiUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)

    // Deve ser HTTPS
    if (url.protocol !== 'https:') {
      return false
    }

    // Verificar se o domínio está na whitelist
    const hostname = url.hostname.toLowerCase()
    const isAllowed = ALLOWED_UAZAPI_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    )

    if (!isAllowed) {
      // Permitir domínios configurados via env (para self-hosted)
      const customDomain = process.env.UAZAPI_CUSTOM_DOMAIN
      if (customDomain && hostname === customDomain.toLowerCase()) {
        return true
      }
      return false
    }

    // Bloquear IPs privados/localhost
    const privatePatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^0\./,
      /^169\.254\./,
    ]

    if (privatePatterns.some(pattern => pattern.test(hostname))) {
      return false
    }

    return true
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    // Rate limiting por IP
    const clientIP = getClientIP(request)
    const rateLimit = checkRateLimit(`send:${clientIP}`, RATE_LIMITS.sendMessage)

    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          },
        }
      )
    }

    const body: SendMessageRequest = await request.json()
    const { apiUrl, apiToken, to, message, mediaUrl, mediaType, fileName, caption } = body

    if (!apiUrl || !apiToken) {
      return NextResponse.json(
        { success: false, error: 'URL da API e Token sao obrigatorios' },
        { status: 400 }
      )
    }

    // SECURITY: Validar URL para prevenir SSRF
    if (!isValidUazapiUrl(apiUrl)) {
      console.error(`[UAZAPI Send] URL rejeitada por seguranca: ${apiUrl}`)
      return NextResponse.json(
        { success: false, error: 'URL da API nao permitida' },
        { status: 403 }
      )
    }

    if (!to) {
      return NextResponse.json(
        { success: false, error: 'Numero de destino e obrigatorio' },
        { status: 400 }
      )
    }

    // Normaliza a URL removendo trailing slash
    const baseUrl = apiUrl.replace(/\/+$/, '')

    // UAZAPI GO v2.0 - Header correto: token: {instance_token}
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'token': apiToken,
    }

    // Normaliza o numero (remove caracteres especiais, mantem apenas digitos)
    const normalizedNumber = to.replace(/\D/g, '')

    let endpoint: string
    let payload: Record<string, unknown>

    if (mediaUrl && mediaType) {
      // Enviar mensagem com midia
      switch (mediaType) {
        case 'image':
          endpoint = `${baseUrl}/send/image`
          payload = {
            number: normalizedNumber,
            image: mediaUrl,
            caption: caption || message || '',
          }
          break
        case 'document':
          endpoint = `${baseUrl}/send/document`
          payload = {
            number: normalizedNumber,
            document: mediaUrl,
            fileName: fileName || 'document',
            caption: caption || message || '',
          }
          break
        case 'audio':
          endpoint = `${baseUrl}/send/audio`
          payload = {
            number: normalizedNumber,
            audio: mediaUrl,
          }
          break
        case 'video':
          endpoint = `${baseUrl}/send/video`
          payload = {
            number: normalizedNumber,
            video: mediaUrl,
            caption: caption || message || '',
          }
          break
        default:
          endpoint = `${baseUrl}/send/text`
          payload = {
            number: normalizedNumber,
            text: message,
          }
      }
    } else {
      // Enviar mensagem de texto simples
      if (!message) {
        return NextResponse.json(
          { success: false, error: 'Mensagem e obrigatoria' },
          { status: 400 }
        )
      }

      endpoint = `${baseUrl}/send/text`
      payload = {
        number: normalizedNumber,
        text: message,
      }
    }

    console.log(`[UAZAPI Send] Enviando para ${endpoint}:`, JSON.stringify(payload).substring(0, 200))

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    console.log(`[UAZAPI Send] Response status: ${response.status}, body: ${responseText.substring(0, 500)}`)

    let data: Record<string, unknown>
    try {
      data = JSON.parse(responseText)
    } catch {
      return NextResponse.json({
        success: false,
        error: `Resposta invalida do servidor: ${responseText.substring(0, 100)}`,
      })
    }

    // Verificar erros
    if (data.error) {
      return NextResponse.json({
        success: false,
        error: data.error as string,
        rawResponse: data,
      })
    }

    if (data.code && (data.code as number) >= 400) {
      return NextResponse.json({
        success: false,
        error: (data.message as string) || `Erro ${data.code}`,
        rawResponse: data,
      })
    }

    // Extrair ID da mensagem
    const messageId = (data.messageid || data.messageId || data.id || data.msgId) as string | undefined

    return NextResponse.json({
      success: true,
      messageId,
      rawResponse: data,
    })
  } catch (error) {
    console.error('[UAZAPI Send] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao enviar mensagem. Verifique a conexao.' },
      { status: 500 }
    )
  }
}
