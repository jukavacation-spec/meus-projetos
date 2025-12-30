import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { accountId, apiKey } = await request.json()

    if (!accountId || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'Account ID e API Key sao obrigatorios' },
        { status: 400 }
      )
    }

    const chatwootUrl = process.env.CHATWOOT_API_URL
    if (!chatwootUrl) {
      return NextResponse.json(
        { success: false, error: 'CHATWOOT_API_URL nao configurada no servidor' },
        { status: 500 }
      )
    }

    // Testar conexao buscando as inboxes
    const response = await fetch(`${chatwootUrl}/api/v1/accounts/${accountId}/inboxes`, {
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': apiKey,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({
          success: false,
          error: 'API Key invalida',
        })
      }
      if (response.status === 404) {
        return NextResponse.json({
          success: false,
          error: 'Account ID nao encontrado',
        })
      }
      return NextResponse.json({
        success: false,
        error: `Erro ${response.status}: ${response.statusText}`,
      })
    }

    const data = await response.json()
    const inboxCount = data.payload?.length || 0

    return NextResponse.json({
      success: true,
      message: `Conexao estabelecida! ${inboxCount} inbox(es) encontrada(s).`,
      inboxes: inboxCount,
    })
  } catch (error) {
    console.error('Error testing Chatwoot connection:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao conectar com Chatwoot. Verifique a URL.' },
      { status: 500 }
    )
  }
}
