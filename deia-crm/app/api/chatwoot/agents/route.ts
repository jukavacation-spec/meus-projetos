import { NextResponse } from 'next/server'
import { getCompanyChatwoot, chatwootRequest } from '@/lib/chatwoot/getCompanyChatwoot'

type Agent = {
  id: number
  name: string
  email: string
  avatar_url: string | null
  availability_status: string
}

export async function GET() {
  try {
    const result = await getCompanyChatwoot()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    const agents = await chatwootRequest<Agent[]>(
      result.credentials,
      '/agents'
    )

    return NextResponse.json({
      agents: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        email: agent.email,
        avatar_url: agent.avatar_url,
        availability_status: agent.availability_status
      }))
    })
  } catch (error) {
    console.error('Error fetching agents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    )
  }
}
