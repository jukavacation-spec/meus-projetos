import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UAZAPI_URL = process.env.UAZAPI_URL

type Instance = {
  id: string
  uazapi_token: string | null
  uazapi_status: string
  [key: string]: unknown
}

/**
 * Verifica status real de uma instancia no UAZAPI
 */
async function checkUazapiStatus(instance: Instance): Promise<string | null> {
  if (!UAZAPI_URL || !instance.uazapi_token) {
    return null
  }

  try {
    const response = await fetch(`${UAZAPI_URL}/instance/status`, {
      method: 'GET',
      headers: {
        'token': instance.uazapi_token,
      },
    })

    if (!response.ok) {
      console.log(`[WhatsApp List] UAZAPI status check failed for ${instance.id}`)
      return null
    }

    const data = await response.json()
    const connStatus = data.status || {}
    const instanceData = data.instance || {}

    // Determinar status real
    if (connStatus.connected || connStatus.loggedIn) {
      return 'connected'
    } else if (instanceData.status === 'qrcode' || instanceData.status === 'waiting') {
      return 'qr_ready'
    } else if (instanceData.status === 'connecting') {
      return 'connecting'
    } else if (connStatus.connected === false) {
      return 'disconnected'
    }

    return null
  } catch (error) {
    console.error(`[WhatsApp List] Error checking UAZAPI status for ${instance.id}:`, error)
    return null
  }
}

/**
 * GET /api/integracoes/whatsapp
 *
 * Lista todas as instancias WhatsApp da empresa do usuario
 * Verifica status real no UAZAPI para instancias marcadas como conectadas
 */
export async function GET() {
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

    // Buscar company do usuario
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({
        success: true,
        instances: [],
      })
    }

    // Buscar instancias
    const { data: instances, error } = await supabase
      .from('instances')
      .select('*')
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[WhatsApp List] Error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch instances' },
        { status: 500 }
      )
    }

    // Verificar status real no UAZAPI para instancias que mostram como conectadas
    // Isso garante que o status exibido na UI esteja sempre atualizado
    const updatedInstances = await Promise.all(
      (instances || []).map(async (instance: Instance) => {
        // Só verificar instancias com token que mostram como conectadas
        if (instance.uazapi_token && instance.uazapi_status === 'connected') {
          const realStatus = await checkUazapiStatus(instance)

          // Se status real é diferente, atualizar banco e retornar status correto
          if (realStatus && realStatus !== instance.uazapi_status) {
            console.log(`[WhatsApp List] Status mismatch for ${instance.id}: DB=${instance.uazapi_status}, UAZAPI=${realStatus}`)

            // Atualizar banco de dados
            await supabase
              .from('instances')
              .update({
                uazapi_status: realStatus,
                disconnected_at: realStatus === 'disconnected' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', instance.id)

            return { ...instance, uazapi_status: realStatus }
          }
        }

        return instance
      })
    )

    return NextResponse.json({
      success: true,
      instances: updatedInstances,
    })

  } catch (error) {
    console.error('[WhatsApp List] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
