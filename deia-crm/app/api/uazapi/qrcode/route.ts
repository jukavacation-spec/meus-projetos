import { NextResponse } from 'next/server'

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

    // Primeiro verificar status - se já conectado, não precisa de QR
    console.log(`[UAZAPI QR] Verificando status primeiro...`)

    const statusResponse = await fetch(`${baseUrl}/instance/status`, {
      method: 'GET',
      headers,
    })

    if (statusResponse.ok) {
      const statusData = await statusResponse.json()
      console.log(`[UAZAPI QR] Status:`, JSON.stringify(statusData).substring(0, 300))

      const instanceData = statusData.instance || {}
      const connStatus = statusData.status || {}

      // Se já conectado, retorna erro
      if (connStatus.connected || connStatus.loggedIn) {
        return NextResponse.json({
          success: false,
          error: 'Instancia ja esta conectada',
          status: 'connected',
          phoneNumber: instanceData.owner || null,
        })
      }

      // Se o status já tem QR code, usa ele
      if (instanceData.qrcode && instanceData.qrcode.length > 10) {
        console.log(`[UAZAPI QR] QR code encontrado no status`)
        return NextResponse.json({
          success: true,
          qrCode: instanceData.qrcode,
          qrCodeDataUrl: instanceData.qrcode.startsWith('data:')
            ? instanceData.qrcode
            : `data:image/png;base64,${instanceData.qrcode}`,
        })
      }
    }

    // UAZAPI GO v2.0 - O endpoint para gerar QR code é POST /instance/connect
    console.log(`[UAZAPI QR] Chamando POST /instance/connect para gerar QR...`)

    const connectResponse = await fetch(`${baseUrl}/instance/connect`, {
      method: 'POST',
      headers,
    })

    console.log(`[UAZAPI QR] /instance/connect - Status: ${connectResponse.status}`)

    if (!connectResponse.ok) {
      let errorDetail = ''
      try {
        const errorBody = await connectResponse.text()
        errorDetail = errorBody.substring(0, 200)
        console.log(`[UAZAPI QR] Erro body:`, errorDetail)
      } catch {
        // ignore
      }

      return NextResponse.json({
        success: false,
        error: `Erro ao gerar QR Code. Status: ${connectResponse.status}`,
        detail: errorDetail,
      })
    }

    const data = await connectResponse.json()
    console.log(`[UAZAPI QR] Resposta connect:`, JSON.stringify(data).substring(0, 500))

    // O QR code vem no campo 'qrcode' ou dentro de 'instance.qrcode'
    const qrCode = data.qrcode || data.instance?.qrcode || null

    if (!qrCode || qrCode.length < 10) {
      console.log(`[UAZAPI QR] QR Code nao encontrado. Campos:`, Object.keys(data))

      // Se está conectando mas sem QR, pode precisar esperar
      if (data.status === 'connecting' || data.response === 'Connecting') {
        return NextResponse.json({
          success: false,
          error: 'Instancia esta iniciando conexao. Tente novamente em alguns segundos.',
          status: 'connecting',
        })
      }

      return NextResponse.json({
        success: false,
        error: 'QR Code nao disponivel. Tente novamente.',
        rawData: data,
      })
    }

    return NextResponse.json({
      success: true,
      qrCode: qrCode,
      // Adiciona prefixo data:image se nao tiver
      qrCodeDataUrl: qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`,
    })
  } catch (error) {
    console.error('[UAZAPI QR] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao conectar com UAZAPI. Verifique a URL e credenciais.' },
      { status: 500 }
    )
  }
}
