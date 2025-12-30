import { NextRequest, NextResponse } from 'next/server'
import { getCompanyChatwoot, chatwootRequest } from '@/lib/chatwoot/getCompanyChatwoot'

type AgentUpdateResponse = {
  id: number
  name: string
  email: string
  display_name: string | null
  avatar_url: string | null
  availability_status: string
}

type RouteParams = {
  params: Promise<{ id: string }>
}

// PATCH /api/chatwoot/agents/[id] - Atualizar agente (status ou nome)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const agentId = parseInt(id, 10)

    if (isNaN(agentId)) {
      return NextResponse.json(
        { error: 'Invalid agent ID' },
        { status: 400 }
      )
    }

    const result = await getCompanyChatwoot()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    const body = await request.json()

    // Preparar dados para o Chatwoot
    // Chatwoot usa PUT e campo "availability" (nao "availability_status")
    const updateData: Record<string, string> = {}

    // Mapear availability_status para availability
    if (body.availability_status) {
      const statusMap: Record<string, string> = {
        'online': 'online',
        'away': 'busy',    // Ausente mapeia para busy
        'busy': 'busy',
        'offline': 'offline',
      }
      updateData.availability = statusMap[body.availability_status] || 'online'
    }

    // Outros campos
    if (body.name) updateData.name = body.name
    if (body.display_name) updateData.display_name = body.display_name

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Chatwoot usa PUT para atualizar agentes
    const agent = await chatwootRequest<AgentUpdateResponse>(
      result.credentials,
      `/agents/${agentId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updateData),
      }
    )

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        display_name: agent.display_name,
        email: agent.email,
        avatar_url: agent.avatar_url,
        availability_status: agent.availability_status,
      },
    })
  } catch (error) {
    console.error('Error updating agent:', error)
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    )
  }
}

// GET /api/chatwoot/agents/[id] - Buscar agente especifico
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const agentId = parseInt(id, 10)

    if (isNaN(agentId)) {
      return NextResponse.json(
        { error: 'Invalid agent ID' },
        { status: 400 }
      )
    }

    const result = await getCompanyChatwoot()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    const agent = await chatwootRequest<AgentUpdateResponse>(
      result.credentials,
      `/agents/${agentId}`
    )

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        display_name: agent.display_name,
        email: agent.email,
        avatar_url: agent.avatar_url,
        availability_status: agent.availability_status,
      },
    })
  } catch (error) {
    console.error('Error fetching agent:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    )
  }
}
