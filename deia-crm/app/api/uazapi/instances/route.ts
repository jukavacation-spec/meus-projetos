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

    // UAZAPI GO v2.0 - Para listar instancias, usar Admin Token no header
    // Header correto: token: {admin_token}
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'token': apiToken,
    }

    // Tentar diferentes endpoints para listar instancias
    const endpoints = [
      `${baseUrl}/instance/fetchInstances`,
      `${baseUrl}/instance/list`,
      `${baseUrl}/instances`,
      `${baseUrl}/instance`,
    ]

    let response: Response | null = null
    let usedEndpoint = ''

    for (const endpoint of endpoints) {
      try {
        console.log(`[UAZAPI Instances] Tentando endpoint: ${endpoint}`)
        response = await fetch(endpoint, {
          method: 'GET',
          headers,
        })

        console.log(`[UAZAPI Instances] ${endpoint} - Status: ${response.status}`)

        if (response.ok) {
          usedEndpoint = endpoint
          break
        }
      } catch (e) {
        console.log(`[UAZAPI Instances] Falha no endpoint ${endpoint}:`, e)
        continue
      }
    }

    if (!response || !response.ok) {
      // Tentar pegar o corpo do erro
      let errorDetail = ''
      if (response) {
        try {
          const errorBody = await response.text()
          errorDetail = errorBody.substring(0, 200)
          console.log(`[UAZAPI Instances] Erro response body:`, errorDetail)
        } catch {
          // ignore
        }
      }

      return NextResponse.json({
        success: false,
        error: `Nao foi possivel listar instancias. Status: ${response?.status || 'N/A'}`,
        detail: errorDetail,
      })
    }

    const data = await response.json()
    console.log(`[UAZAPI Instances] Resposta:`, JSON.stringify(data).substring(0, 500))

    // Extrair lista de instancias (pode vir em diferentes formatos)
    let instances: string[] = []

    if (Array.isArray(data)) {
      instances = data.map((inst: { instanceName?: string; name?: string; instance?: string }) =>
        inst.instanceName || inst.name || inst.instance || JSON.stringify(inst)
      )
    } else if (data.instances && Array.isArray(data.instances)) {
      instances = data.instances.map((inst: { instanceName?: string; name?: string; instance?: string }) =>
        inst.instanceName || inst.name || inst.instance || JSON.stringify(inst)
      )
    } else if (data.data && Array.isArray(data.data)) {
      instances = data.data.map((inst: { instanceName?: string; name?: string; instance?: string }) =>
        inst.instanceName || inst.name || inst.instance || JSON.stringify(inst)
      )
    }

    return NextResponse.json({
      success: true,
      instances,
      endpoint: usedEndpoint,
      rawData: data,
    })
  } catch (error) {
    console.error('[UAZAPI Instances] Erro:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao listar instancias' },
      { status: 500 }
    )
  }
}
