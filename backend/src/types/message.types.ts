export interface CreateMessageInput {
  content?: unknown
}

export interface MessageResponse {
  id: string
  content: string
  ticketId: string
  senderId: string
  isInternal: boolean
  createdAt: Date
}

export interface MessageListResponse {
  messages: MessageResponse[]
}

