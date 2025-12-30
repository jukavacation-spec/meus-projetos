import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

// GET - Lista roles da empresa do usuário
export async function GET() {
  try {
    // Verificar autenticação
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Usar service role para bypassing RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar company_id do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.company_id) {
      return NextResponse.json(
        { success: false, error: 'Usuário sem empresa associada' },
        { status: 400 }
      )
    }

    // Buscar roles da empresa
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('roles')
      .select('*')
      .eq('company_id', userData.company_id)
      .order('name', { ascending: true })

    if (rolesError) {
      console.error('[API /roles] Error:', rolesError)
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar roles' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      roles,
    })
  } catch {
    console.error('[API /roles] Unexpected error')
    return NextResponse.json(
      { success: false, error: 'Erro interno' },
      { status: 500 }
    )
  }
}
