import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UAZAPI_URL = process.env.UAZAPI_URL
const UAZAPI_MASTER_TOKEN = process.env.UAZAPI_MASTER_TOKEN

/**
 * GET /api/integracoes/whatsapp/qr?instanceId=xxx
 *
 * Busca o QR Code de uma instancia WhatsApp
 *
 * Output: { success, qrCode (base64), status }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticacao
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const instanceId = request.nextUrl.searchParams.get('instanceId')

    if (!instanceId) {
      return NextResponse.json(
        { success: false, error: 'instanceId is required' },
        { status: 400 }
      )
    }

    // Buscar instancia do banco
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('*, company:companies(id)')
      .eq('id', instanceId)
      .single()

    if (instanceError || !instance) {
      return NextResponse.json(
        { success: false, error: 'Instance not found' },
        { status: 404 }
      )
    }

    // Verificar se usuario pertence a mesma empresa
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (userData?.company_id !== instance.company_id) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    if (!UAZAPI_URL || !UAZAPI_MASTER_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'UAZAPI not configured' },
        { status: 500 }
      )
    }

    const token = instance.uazapi_token

    if (!token) {
      console.error(`[WhatsApp QR] Instance ${instanceId} has no uazapi_token`)
      return NextResponse.json({
        success: false,
        error: 'Instance token not found. Please recreate the instance.',
        status: 'error',
      })
    }

    // Primeiro verificar status - isso também retorna o QR code se disponível
    const statusResponse = await fetch(`${UAZAPI_URL}/instance/status`, {
      method: 'GET',
      headers: {
        'token': token,
      },
    })

    if (statusResponse.ok) {
      const statusData = await statusResponse.json()
      const connStatus = statusData.status || {}
      const instanceData = statusData.instance || {}

      // Se ja conectado, retorna erro
      if (connStatus.loggedIn) {
        return NextResponse.json({
          success: false,
          error: 'Instance already connected',
          status: 'connected',
          phoneNumber: instanceData.owner || null,
        })
      }

      // Se o status ja tem QR code, usa ele
      if (instanceData.qrcode && instanceData.qrcode.length > 50) {
        // Atualizar status no banco
        await supabase
          .from('instances')
          .update({ uazapi_status: 'qr_ready' })
          .eq('id', instanceId)

        return NextResponse.json({
          success: true,
          qrCode: instanceData.qrcode,
          qrCodeDataUrl: instanceData.qrcode.startsWith('data:')
            ? instanceData.qrcode
            : `data:image/png;base64,${instanceData.qrcode}`,
          status: 'qr_ready',
        })
      }
    }

    // Tentar gerar QR code via connect
    const connectResponse = await fetch(`${UAZAPI_URL}/instance/connect`, {
      method: 'POST',
      headers: {
        'token': token,
        'Content-Type': 'application/json',
      },
    })

    if (!connectResponse.ok) {
      const errorText = await connectResponse.text()
      console.error(`[WhatsApp QR] Connect error: ${errorText}`)
      return NextResponse.json({
        success: false,
        error: 'Failed to generate QR code',
        status: 'error',
      })
    }

    const connectData = await connectResponse.json()
    const qrCode = connectData.qrcode || connectData.instance?.qrcode

    if (!qrCode || qrCode.length < 50) {
      // Pode estar em processo de conexao - verificar status novamente
      const retryStatus = await fetch(`${UAZAPI_URL}/instance/status`, {
        method: 'GET',
        headers: { 'token': token },
      })

      if (retryStatus.ok) {
        const retryData = await retryStatus.json()
        if (retryData.instance?.qrcode && retryData.instance.qrcode.length > 50) {
          await supabase
            .from('instances')
            .update({ uazapi_status: 'qr_ready' })
            .eq('id', instanceId)

          return NextResponse.json({
            success: true,
            qrCode: retryData.instance.qrcode,
            qrCodeDataUrl: retryData.instance.qrcode.startsWith('data:')
              ? retryData.instance.qrcode
              : `data:image/png;base64,${retryData.instance.qrcode}`,
            status: 'qr_ready',
          })
        }
      }

      await supabase
        .from('instances')
        .update({ uazapi_status: 'connecting' })
        .eq('id', instanceId)

      return NextResponse.json({
        success: false,
        error: 'QR code is being generated. Please wait...',
        status: 'connecting',
      })
    }

    // Atualizar status no banco
    await supabase
      .from('instances')
      .update({ uazapi_status: 'qr_ready' })
      .eq('id', instanceId)

    return NextResponse.json({
      success: true,
      qrCode: qrCode,
      qrCodeDataUrl: qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`,
      status: 'qr_ready',
    })

  } catch (error) {
    console.error('[WhatsApp QR] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
