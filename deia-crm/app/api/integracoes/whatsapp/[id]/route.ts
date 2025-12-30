import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UAZAPI_URL = process.env.UAZAPI_URL
const CHATWOOT_API_URL = process.env.CHATWOOT_API_URL

/**
 * DELETE /api/integracoes/whatsapp/[id]
 *
 * Remove uma instancia WhatsApp
 * - Desconecta do UAZAPI
 * - Opcionalmente remove inbox do Chatwoot
 * - Remove do banco de dados
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instanceId } = await params
    const supabase = await createClient()

    // Verificar autenticacao
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Buscar instancia
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('*, company:companies(id, chatwoot_account_id, chatwoot_api_key)')
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

    console.log(`[WhatsApp Delete] Deleting instance: ${instanceId}`)

    // 1. Desconectar e deletar instancia UAZAPI
    if (UAZAPI_URL && instance.uazapi_token) {
      // Passo 1.1: Logout (desconectar sessao WhatsApp)
      try {
        const logoutResponse = await fetch(`${UAZAPI_URL}/instance/logout`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
            'token': instance.uazapi_token,
          },
        })
        console.log(`[WhatsApp Delete] UAZAPI logout response: ${logoutResponse.status}`)
      } catch (uazapiError) {
        console.error('[WhatsApp Delete] UAZAPI logout error:', uazapiError)
        // Continua mesmo com erro
      }

      // Passo 1.2: Deletar instancia completamente do UAZAPI
      try {
        const deleteResponse = await fetch(`${UAZAPI_URL}/instance/delete`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
            'token': instance.uazapi_token,
          },
        })
        console.log(`[WhatsApp Delete] UAZAPI delete response: ${deleteResponse.status}`)
      } catch (uazapiError) {
        console.error('[WhatsApp Delete] UAZAPI delete error:', uazapiError)
        // Continua mesmo com erro
      }
    }

    // 2. Deletar inbox do Chatwoot (opcional)
    const company = instance.company as { id: string; chatwoot_account_id: number; chatwoot_api_key: string } | null
    if (
      CHATWOOT_API_URL &&
      instance.chatwoot_inbox_id &&
      company?.chatwoot_account_id &&
      company?.chatwoot_api_key
    ) {
      try {
        await fetch(
          `${CHATWOOT_API_URL}/api/v1/accounts/${company.chatwoot_account_id}/inboxes/${instance.chatwoot_inbox_id}`,
          {
            method: 'DELETE',
            headers: {
              'api_access_token': company.chatwoot_api_key,
            },
          }
        )
        console.log(`[WhatsApp Delete] Chatwoot inbox deleted`)
      } catch (chatwootError) {
        console.error('[WhatsApp Delete] Chatwoot error:', chatwootError)
        // Continua mesmo com erro
      }
    }

    // 3. Deletar do banco
    const { error: deleteError } = await supabase
      .from('instances')
      .delete()
      .eq('id', instanceId)

    if (deleteError) {
      console.error('[WhatsApp Delete] Database error:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete instance' },
        { status: 500 }
      )
    }

    console.log(`[WhatsApp Delete] Instance deleted: ${instanceId}`)

    return NextResponse.json({
      success: true,
      message: 'Instance deleted successfully',
    })

  } catch (error) {
    console.error('[WhatsApp Delete] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/integracoes/whatsapp/[id]?action=reconnect
 *
 * Reconecta uma instancia desconectada (gera novo QR)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instanceId } = await params
    const action = request.nextUrl.searchParams.get('action')

    if (action !== 'reconnect') {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verificar autenticacao
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Buscar instancia
    const { data: instance } = await supabase
      .from('instances')
      .select('*')
      .eq('id', instanceId)
      .single()

    if (!instance) {
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

    // Atualizar status para pending (vai gerar novo QR)
    await supabase
      .from('instances')
      .update({
        uazapi_status: 'pending',
        disconnected_at: null,
      })
      .eq('id', instanceId)

    return NextResponse.json({
      success: true,
      message: 'Instance ready for reconnection',
    })

  } catch (error) {
    console.error('[WhatsApp Reconnect] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
