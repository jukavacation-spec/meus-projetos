import { NextRequest, NextResponse } from 'next/server'

const CHATWOOT_API_URL = process.env.CHATWOOT_API_URL || ''
const CHATWOOT_API_KEY = process.env.CHATWOOT_API_KEY || ''
const CHATWOOT_ACCOUNT_ID = 1

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const conversationId = formData.get('conversationId')
    const content = formData.get('content') || ''
    const file = formData.get('file') as File | null

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      )
    }

    if (!file) {
      return NextResponse.json(
        { error: 'file is required' },
        { status: 400 }
      )
    }

    // Create new FormData for Chatwoot
    const chatwootFormData = new FormData()
    chatwootFormData.append('content', String(content))
    chatwootFormData.append('message_type', 'outgoing')
    chatwootFormData.append('private', 'false')
    chatwootFormData.append('attachments[]', file)

    const url = `${CHATWOOT_API_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api_access_token': CHATWOOT_API_KEY,
      },
      body: chatwootFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Chatwoot upload error:', errorText)
      throw new Error(`Chatwoot API error: ${response.status}`)
    }

    const message = await response.json()

    return NextResponse.json({
      message: {
        id: String(message.id),
        content: message.content || '',
        message_type: 'outgoing',
        created_at: new Date(message.created_at * 1000).toISOString(),
        status: 'sent',
        attachments: message.attachments?.map((att: {
          id: number
          file_type: string
          data_url: string
          thumb_url: string | null
          file_size: number
          extension: string | null
        }) => ({
          id: att.id,
          file_type: att.file_type,
          data_url: att.data_url,
          thumb_url: att.thumb_url,
          file_size: att.file_size,
          extension: att.extension
        })) || []
      }
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
