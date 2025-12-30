export type ChatwootConversation = {
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
  created_at: number
  updated_at: number
}

export type ChatwootMessage = {
  id: number
  content: string
  message_type: number // 0 = incoming, 1 = outgoing, 2 = activity
  content_type: string
  private?: boolean
  created_at: number
  sender: {
    id: number
    name: string
    type: string
  } | null
}

export type ChatwootContact = {
  id: number
  name: string
  phone_number: string
  email: string | null
  thumbnail: string
  created_at: string
}
