import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/integracoes/whatsapp/[id]/access
 *
 * Lista todos os usuarios que tem acesso a uma instancia
 * Retorna tambem os membros da equipe para selecao
 */
export async function GET(
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

    // Buscar usuario e verificar se e admin/owner
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role:roles(name)')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json(
        { success: false, error: 'User has no company' },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roleName = (userData.role as any)?.name

    // Verificar se instancia pertence a empresa
    const { data: instance } = await supabase
      .from('instances')
      .select('id, name, company_id')
      .eq('id', instanceId)
      .single()

    if (!instance || instance.company_id !== userData.company_id) {
      return NextResponse.json(
        { success: false, error: 'Instance not found' },
        { status: 404 }
      )
    }

    // Buscar acessos existentes
    const { data: accessList } = await supabase
      .from('instance_access')
      .select(`
        id,
        user_id,
        created_at,
        user:users(id, name, email, avatar_url, role:roles(name, display_name))
      `)
      .eq('instance_id', instanceId)

    // Buscar todos os membros da equipe (para selecao)
    const { data: teamMembers } = await supabase
      .from('users')
      .select('id, name, email, avatar_url, role:roles(name, display_name)')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)

    // Marcar quais membros tem acesso
    const membersWithAccess = (teamMembers || []).map(member => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memberRole = (member.role as any)?.name
      const isAdminOrOwner = ['owner', 'admin'].includes(memberRole)
      const hasExplicitAccess = accessList?.some(a => a.user_id === member.id)

      return {
        ...member,
        hasAccess: isAdminOrOwner || hasExplicitAccess,
        isAdminOrOwner,
        canToggle: !isAdminOrOwner, // Admins/owners sempre tem acesso
      }
    })

    return NextResponse.json({
      success: true,
      instance: {
        id: instance.id,
        name: instance.name,
      },
      accessList: accessList || [],
      members: membersWithAccess,
      canManage: ['owner', 'admin'].includes(roleName),
    })

  } catch (error) {
    console.error('[Instance Access GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/integracoes/whatsapp/[id]/access
 *
 * Adiciona acesso de um usuario a uma instancia
 * Input: { userId }
 */
export async function POST(
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

    // Verificar se e admin/owner
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role:roles(name)')
      .eq('id', user.id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roleName = (userData?.role as any)?.name
    if (!['owner', 'admin'].includes(roleName)) {
      return NextResponse.json(
        { success: false, error: 'Only admins can manage access' },
        { status: 403 }
      )
    }

    // Verificar se instancia pertence a empresa
    const { data: instance } = await supabase
      .from('instances')
      .select('id, company_id')
      .eq('id', instanceId)
      .single()

    if (!instance || instance.company_id !== userData?.company_id) {
      return NextResponse.json(
        { success: false, error: 'Instance not found' },
        { status: 404 }
      )
    }

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // Verificar se usuario pertence a mesma empresa
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('id', userId)
      .single()

    if (!targetUser || targetUser.company_id !== userData?.company_id) {
      return NextResponse.json(
        { success: false, error: 'User not found in company' },
        { status: 404 }
      )
    }

    // Inserir acesso
    const { data: access, error: insertError } = await supabase
      .from('instance_access')
      .insert({
        instance_id: instanceId,
        user_id: userId,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'User already has access' },
          { status: 400 }
        )
      }
      throw insertError
    }

    return NextResponse.json({
      success: true,
      access,
    })

  } catch (error) {
    console.error('[Instance Access POST] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/integracoes/whatsapp/[id]/access
 *
 * Remove acesso de um usuario a uma instancia
 * Query: ?userId=xxx
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

    // Verificar se e admin/owner
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role:roles(name)')
      .eq('id', user.id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roleName = (userData?.role as any)?.name
    if (!['owner', 'admin'].includes(roleName)) {
      return NextResponse.json(
        { success: false, error: 'Only admins can manage access' },
        { status: 403 }
      )
    }

    const userId = request.nextUrl.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // Verificar se instancia pertence a empresa
    const { data: instance } = await supabase
      .from('instances')
      .select('id, company_id')
      .eq('id', instanceId)
      .single()

    if (!instance || instance.company_id !== userData?.company_id) {
      return NextResponse.json(
        { success: false, error: 'Instance not found' },
        { status: 404 }
      )
    }

    // Remover acesso
    const { error: deleteError } = await supabase
      .from('instance_access')
      .delete()
      .eq('instance_id', instanceId)
      .eq('user_id', userId)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({
      success: true,
    })

  } catch (error) {
    console.error('[Instance Access DELETE] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
