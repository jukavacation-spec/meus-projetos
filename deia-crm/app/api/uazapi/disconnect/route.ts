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

    // Tentar diferentes endpoints para logout/disconnect
    const logoutEndpoints = [
      { url: `${baseUrl}/instance/logout`, method: 'DELETE' },
      { url: `${baseUrl}/instance/logout`, method: 'POST' },
      { url: `${baseUrl}/instance/disconnect`, method: 'DELETE' },
      { url: `${baseUrl}/instance/disconnect`, method: 'POST' },
    ]

    let response: Response | null = null
    let usedEndpoint = ''

    for (const endpoint of logoutEndpoints) {
      try {
        console.log(`[UAZAPI Disconnect] Tentando ${endpoint.method} ${endpoint.url}`)
        response = await fetch(endpoint.url, {
          method: endpoint.method,
          headers,
        })

        console.log(`[UAZAPI Disconnect] ${endpoint.url} - Status: ${response.status}`)

        if (response.ok) {
          usedEndpoint = `${endpoint.method} ${endpoint.url}`
          break
        }
      } catch (e) {
        console.log(`[UAZAPI Disconnect] Falha no endpoint ${endpoint.url}:`, e)
        continue
      }
    }

    if (!response || !response.ok) {
      if (response?.status === 401) {
        return NextResponse.json({
          success: false,
          error: 'Token de instancia invalido',
        })
      }
      if (response?.status === 404) {
        return NextResponse.json({
          success: false,
          error: 'Instancia nao encontrada',
        })
      }

      // Tentar ler o erro da resposta
      let errorDetail = ''
      if (response) {
        try {
          const errorBody = await response.text()
          errorDetail = errorBody.substring(0, 200)
          console.log(`[UAZAPI Disconnect] Erro body:`, errorDetail)
        } catch {
          // ignore
        }
      }

      return NextResponse.json({
        success: false,
        error: `Erro ao desconectar. Status: ${response?.status || 'N/A'}`,
        detail: errorDetail,
      })
    }

    console.log(`[UAZAPI Disconnect] Sucesso usando: ${usedEndpoint}`)

    return NextResponse.json({
      success: true,
      message: 'Instancia desconectada com sucesso',
    })
  } catch (error) {
    console.error('[UAZAPI Disconnect] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao desconectar instancia. Verifique a URL e credenciais.' },
      { status: 500 }
    )
  }
}
