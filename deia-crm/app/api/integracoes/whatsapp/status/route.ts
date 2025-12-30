import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UAZAPI_URL = process.env.UAZAPI_URL
const UAZAPI_MASTER_TOKEN = process.env.UAZAPI_MASTER_TOKEN

/**
 * GET /api/integracoes/whatsapp/status?instanceId=xxx
 *
 * Verifica o status de conexao de uma instancia WhatsApp
 * Se conectado, atualiza os dados do perfil WhatsApp
 *
 * Output: { success, status, whatsappNumber, profileName, profilePic }
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
      .select('*')
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

    // Se UAZAPI nao configurado, retorna status do banco
    if (!UAZAPI_URL) {
      return NextResponse.json({
        success: true,
        status: instance.uazapi_status,
        whatsappNumber: instance.whatsapp_number,
        profileName: instance.whatsapp_profile_name,
        profilePic: instance.whatsapp_profile_pic_url,
        instance,
      })
    }

    const token = instance.uazapi_token || UAZAPI_MASTER_TOKEN

    // Verificar status na UAZAPI
    try {
      const statusResponse = await fetch(`${UAZAPI_URL}/instance/status`, {
        method: 'GET',
        headers: {
          'token': token!,
        },
      })

      if (!statusResponse.ok) {
        return NextResponse.json({
          success: true,
          status: instance.uazapi_status,
          whatsappNumber: instance.whatsapp_number,
          profileName: instance.whatsapp_profile_name,
          profilePic: instance.whatsapp_profile_pic_url,
          instance,
        })
      }

      const statusData = await statusResponse.json()
      const connStatus = statusData.status || {}
      const instanceData = statusData.instance || {}

      // Determinar status
      let newStatus: string = instance.uazapi_status

      if (connStatus.connected || connStatus.loggedIn) {
        newStatus = 'connected'
      } else if (instanceData.status === 'qrcode' || instanceData.status === 'waiting') {
        newStatus = 'qr_ready'
      } else if (instanceData.status === 'connecting') {
        newStatus = 'connecting'
      } else if (connStatus.connected === false) {
        newStatus = 'disconnected'
      }

      // Se conectado, extrair dados do perfil
      let whatsappNumber = instance.whatsapp_number
      let profileName = instance.whatsapp_profile_name
      let profilePic = instance.whatsapp_profile_pic_url

      if (newStatus === 'connected') {
        // Extrair numero
        if (instanceData.owner) {
          // Formato: 5547992869699@s.whatsapp.net ou similar
          const ownerPhone = instanceData.owner.split('@')[0]
          whatsappNumber = formatPhoneNumber(ownerPhone)
        }

        // Extrair nome do perfil
        if (instanceData.profileName) {
          profileName = instanceData.profileName
        }

        // Extrair foto
        if (instanceData.profilePicUrl || instanceData.profilePictureUrl) {
          profilePic = instanceData.profilePicUrl || instanceData.profilePictureUrl
        }
      }

      // Atualizar banco se houve mudanca
      if (
        newStatus !== instance.uazapi_status ||
        whatsappNumber !== instance.whatsapp_number ||
        profileName !== instance.whatsapp_profile_name
      ) {
        await supabase
          .from('instances')
          .update({
            uazapi_status: newStatus,
            whatsapp_number: whatsappNumber,
            whatsapp_profile_name: profileName,
            whatsapp_profile_pic_url: profilePic,
            whatsapp_is_business: instanceData.isBusiness || false,
            whatsapp_platform: instanceData.platform,
            connected_at: newStatus === 'connected' && !instance.connected_at
              ? new Date().toISOString()
              : instance.connected_at,
            disconnected_at: newStatus === 'disconnected'
              ? new Date().toISOString()
              : null,
          })
          .eq('id', instanceId)
      }

      return NextResponse.json({
        success: true,
        status: newStatus,
        whatsappNumber,
        profileName,
        profilePic,
        isBusiness: instanceData.isBusiness || false,
        platform: instanceData.platform,
        instance: {
          ...instance,
          uazapi_status: newStatus,
          whatsapp_number: whatsappNumber,
          whatsapp_profile_name: profileName,
          whatsapp_profile_pic_url: profilePic,
        },
      })

    } catch (uazapiError) {
      console.error('[WhatsApp Status] UAZAPI error:', uazapiError)
      // Retorna status do banco em caso de erro
      return NextResponse.json({
        success: true,
        status: instance.uazapi_status,
        whatsappNumber: instance.whatsapp_number,
        profileName: instance.whatsapp_profile_name,
        profilePic: instance.whatsapp_profile_pic_url,
        instance,
      })
    }

  } catch (error) {
    console.error('[WhatsApp Status] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function formatPhoneNumber(phone: string): string {
  // Remove caracteres nao numericos
  const digits = phone.replace(/\D/g, '')

  // Formato brasileiro: +55 47 99286-9699
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4)
    const part1 = digits.slice(4, 9)
    const part2 = digits.slice(9)
    return `+55 ${ddd} ${part1}-${part2}`
  }

  if (digits.length === 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4)
    const part1 = digits.slice(4, 8)
    const part2 = digits.slice(8)
    return `+55 ${ddd} ${part1}-${part2}`
  }

  // Retorna com + se comecar com 55
  if (digits.startsWith('55')) {
    return `+${digits}`
  }

  return digits
}
