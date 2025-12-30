import { NextRequest, NextResponse } from 'next/server'
import { getCompanyChatwoot, chatwootRequest } from '@/lib/chatwoot/getCompanyChatwoot'

type Label = {
  id: number
  title: string
  color: string
  description?: string
}

// GET - Buscar todas as labels
export async function GET() {
  try {
    const result = await getCompanyChatwoot()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    const response = await chatwootRequest<{ payload: Label[] }>(
      result.credentials,
      '/labels'
    )

    return NextResponse.json({
      labels: response.payload.map(label => ({
        id: label.id,
        title: label.title,
        color: label.color,
        description: label.description
      }))
    })
  } catch (error) {
    console.error('Error fetching labels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch labels' },
      { status: 500 }
    )
  }
}

// POST - Criar nova label
export async function POST(request: NextRequest) {
  try {
    const result = await getCompanyChatwoot()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    const body = await request.json()
    const { title, color, description } = body

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    const response = await chatwootRequest<Label>(
      result.credentials,
      '/labels',
      {
        method: 'POST',
        body: JSON.stringify({
          title,
          color: color || '#6366f1',
          description: description || '',
          show_on_sidebar: true
        })
      }
    )

    return NextResponse.json({
      success: true,
      label: {
        id: response.id,
        title: response.title,
        color: response.color
      }
    })
  } catch (error) {
    console.error('Error creating label:', error)
    return NextResponse.json(
      { error: 'Failed to create label' },
      { status: 500 }
    )
  }
}

// PATCH - Atualizar label existente
export async function PATCH(request: NextRequest) {
  try {
    const result = await getCompanyChatwoot()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    const body = await request.json()
    const { id, title, color, description } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Label ID is required' },
        { status: 400 }
      )
    }

    const response = await chatwootRequest<Label>(
      result.credentials,
      `/labels/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          color,
          description
        })
      }
    )

    return NextResponse.json({
      success: true,
      label: {
        id: response.id,
        title: response.title,
        color: response.color
      }
    })
  } catch (error) {
    console.error('Error updating label:', error)
    return NextResponse.json(
      { error: 'Failed to update label' },
      { status: 500 }
    )
  }
}

// DELETE - Deletar label
export async function DELETE(request: NextRequest) {
  try {
    const result = await getCompanyChatwoot()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Label ID is required' },
        { status: 400 }
      )
    }

    await chatwootRequest(
      result.credentials,
      `/labels/${id}`,
      { method: 'DELETE' }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting label:', error)
    return NextResponse.json(
      { error: 'Failed to delete label' },
      { status: 500 }
    )
  }
}
