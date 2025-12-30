const CHATWOOT_API_URL = process.env.CHATWOOT_API_URL || ''
const CHATWOOT_API_KEY = process.env.CHATWOOT_API_KEY || ''
const CHATWOOT_ACCOUNT_ID = 1 // Seu account ID

type ChatwootConversation = {
  id: number
  inbox_id: number
  status: string
  priority: string | null
  assignee: {
    id: number
    name: string
    email: string
  } | null
  meta: {
    sender: {
      id: number
      name: string
      phone_number: string
      email: string | null
      thumbnail: string
    }
  }
  messages: ChatwootMessage[]
  last_non_activity_message?: {
    id: number
    content: string
    message_type: number
    content_type: string
    content_attributes?: {
      items?: Array<{
        type: string
        title: string
      }>
    }
    attachments?: Array<{
      file_type: string
      data_url: string
    }>
    created_at: number
  }
  unread_count?: number
  created_at: number
  updated_at: number
}

type ChatwootAttachment = {
  id: number
  message_id: number
  file_type: 'image' | 'audio' | 'video' | 'file' | 'location'
  account_id: number
  extension: string | null
  data_url: string
  thumb_url: string | null
  file_size: number
}

type ChatwootMessage = {
  id: number
  content: string
  message_type: number // 0 = incoming, 1 = outgoing
  content_type: string
  created_at: number
  attachments?: ChatwootAttachment[]
  sender: {
    id: number
    name: string
    type: string
  } | null
}

type ChatwootContact = {
  id: number
  name: string
  phone_number: string
  email: string | null
  thumbnail: string
  created_at: string
}

type ChatwootInbox = {
  id: number
  name: string
  channel_type: string
  avatar_url: string | null
  website_url: string | null
  enable_auto_assignment: boolean
  web_widget_script: string | null
  phone_number: string | null
}

class ChatwootClient {
  private baseUrl: string
  private apiKey: string
  private accountId: number

  constructor() {
    this.baseUrl = CHATWOOT_API_URL
    this.apiKey = CHATWOOT_API_KEY
    this.accountId = CHATWOOT_ACCOUNT_ID
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v1/accounts/${this.accountId}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api_access_token': this.apiKey,
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Chatwoot API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Buscar todas as inboxes
  async getInboxes(): Promise<{ payload: ChatwootInbox[] }> {
    return this.request('/inboxes')
  }

  // Buscar uma inbox específica
  async getInbox(inboxId: number): Promise<ChatwootInbox> {
    return this.request(`/inboxes/${inboxId}`)
  }

  // Buscar todas as conversas (opcionalmente filtrar por inbox)
  async getConversations(
    status: 'open' | 'resolved' | 'pending' | 'all' = 'open',
    inboxId?: number
  ): Promise<{ data: { payload: ChatwootConversation[] } }> {
    let url = `/conversations?status=${status}`
    if (inboxId) {
      url += `&inbox_id=${inboxId}`
    }
    return this.request(url)
  }

  // Buscar uma conversa específica
  async getConversation(conversationId: number): Promise<ChatwootConversation> {
    return this.request(`/conversations/${conversationId}`)
  }

  // Buscar mensagens de uma conversa
  async getMessages(conversationId: number): Promise<{ payload: ChatwootMessage[] }> {
    return this.request(`/conversations/${conversationId}/messages`)
  }

  // Enviar mensagem
  async sendMessage(conversationId: number, content: string, isPrivate = false): Promise<ChatwootMessage> {
    return this.request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        message_type: 'outgoing',
        private: isPrivate,
      }),
    })
  }

  // Enviar mensagem com anexo (usando FormData)
  async sendMessageWithAttachment(
    conversationId: number,
    content: string,
    file: File,
    isPrivate = false
  ): Promise<ChatwootMessage> {
    const url = `${this.baseUrl}/api/v1/accounts/${this.accountId}/conversations/${conversationId}/messages`

    const formData = new FormData()
    formData.append('content', content)
    formData.append('message_type', 'outgoing')
    formData.append('private', String(isPrivate))
    formData.append('attachments[]', file)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api_access_token': this.apiKey,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Chatwoot API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Buscar contatos
  async getContacts(): Promise<{ payload: ChatwootContact[] }> {
    return this.request('/contacts')
  }

  // Buscar contato específico
  async getContact(contactId: number): Promise<ChatwootContact> {
    return this.request(`/contacts/${contactId}`)
  }

  // Atualizar status da conversa
  async updateConversationStatus(conversationId: number, status: 'open' | 'resolved' | 'pending'): Promise<ChatwootConversation> {
    return this.request(`/conversations/${conversationId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    })
  }

  // Atribuir conversa a um agente
  async assignConversation(conversationId: number, assigneeId: number): Promise<ChatwootConversation> {
    return this.request(`/conversations/${conversationId}/assignments`, {
      method: 'POST',
      body: JSON.stringify({ assignee_id: assigneeId }),
    })
  }

  // Buscar labels de uma conversa
  async getConversationLabels(conversationId: number): Promise<{ payload: string[] }> {
    return this.request(`/conversations/${conversationId}/labels`)
  }

  // Adicionar labels a uma conversa
  async addConversationLabels(conversationId: number, labels: string[]): Promise<{ payload: string[] }> {
    return this.request(`/conversations/${conversationId}/labels`, {
      method: 'POST',
      body: JSON.stringify({ labels }),
    })
  }

  // Buscar todos os labels disponíveis
  async getLabels(): Promise<{ payload: Array<{ id: number; title: string; color: string; description?: string }> }> {
    return this.request('/labels')
  }

  // Criar uma nova label
  async createLabel(title: string, color: string, description?: string): Promise<{ id: number; title: string; color: string }> {
    return this.request('/labels', {
      method: 'POST',
      body: JSON.stringify({
        title,
        color,
        description: description || '',
        show_on_sidebar: true
      }),
    })
  }

  // Atualizar uma label existente
  async updateLabel(labelId: number, title: string, color: string, description?: string): Promise<{ id: number; title: string; color: string }> {
    return this.request(`/labels/${labelId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title,
        color,
        description: description || ''
      }),
    })
  }

  // Deletar uma label
  async deleteLabel(labelId: number): Promise<void> {
    await this.request(`/labels/${labelId}`, {
      method: 'DELETE',
    })
  }

  // Buscar agentes
  async getAgents(): Promise<Array<{ id: number; name: string; email: string; avatar_url: string | null; availability_status: string }>> {
    return this.request('/agents')
  }

  // Marcar conversa como lida (atualiza o last_seen do agente)
  async markAsRead(conversationId: number): Promise<{ id: number; agent_last_seen_at: number }> {
    return this.request(`/conversations/${conversationId}/update_last_seen`, {
      method: 'POST',
    })
  }
}

export const chatwootClient = new ChatwootClient()
export type { ChatwootConversation, ChatwootMessage, ChatwootContact, ChatwootInbox, ChatwootAttachment }
